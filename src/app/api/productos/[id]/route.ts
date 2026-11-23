import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName, generateSKU } from "@/lib/productos";

// GET /api/productos/[id] - Obtener detalles de un producto y su stock en todas las sucursales
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const productoId = parseInt(id);

    if (isNaN(productoId)) {
      return NextResponse.json(
        { error: "ID de producto inválido" },
        { status: 400 }
      );
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        laboratorio: true,
        categorias: true,
        formaFarmaceuticaRel: true,
        compuestos: {
          include: {
            compuesto: true
          }
        },
        inventarios: {
          include: {
            sucursal: {
              select: { nombre: true },
            },
          },
        },
      },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...producto,
      nombreProducto: getFullProductName(producto),
    });
  } catch (error) {
    console.error("Error al obtener detalles del producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/productos/[id] - Actualizar producto (Solo Admin)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const productoId = parseInt(id);

    if (isNaN(productoId)) {
      return NextResponse.json(
        { error: "ID de producto inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      nombreProducto,
      nombreComercial,
      nombreGenerico,
      compuestos, // array de compuestos
      concentracion,
      formaFarmaceuticaId,
      presentacion,
      marca,
      sku,
      codigoBarras,
      categoriasIds, // array de ids de categorias
      laboratorioId,
      laboratorioNombre,
      cantidadPresentacion,
      cantidadPresentacionBlister,
      contenidoNetoValor,
      contenidoNetoUnidad,
      esGenerico,
      precioCaja,
      precioUnidad,
      precioBlister,
      costo,
      sucursalId,
    } = body;

    const validCompuestos = compuestos && Array.isArray(compuestos)
      ? compuestos.filter(c => c.compuestoId && c.compuestoId !== "")
      : [];

    let activeFormaFarmaceuticaId = formaFarmaceuticaId !== undefined ? (formaFarmaceuticaId ? parseInt(formaFarmaceuticaId) : null) : undefined;

    // 1. Ejecutar búsquedas en paralelo para validar SKU y Código de Barras duplicado
    const [currentProduct, existingSkuProduct, existingBarcodeProduct] = await Promise.all([
      prisma.producto.findUnique({
        where: { id: productoId },
        include: { laboratorio: true }
      }),
      sku ? prisma.producto.findFirst({ where: { sku, NOT: { id: productoId } } }) : Promise.resolve(null),
      codigoBarras ? prisma.producto.findFirst({ where: { codigoBarras, NOT: { id: productoId } } }) : Promise.resolve(null)
    ]);

    if (!currentProduct) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // 2. Procesar compuestos (many-to-many explícito con concentración)
    let finalNombreGenerico = nombreGenerico;
    let finalConcentracion = concentracion;
    let compuestosConnection: any = undefined;
    
    if (compuestos !== undefined) {
      if (Array.isArray(compuestos) && validCompuestos.length > 0) {
        compuestosConnection = {
          deleteMany: {},
          create: validCompuestos.map(c => ({
            compuestoId: parseInt(c.compuestoId.toString()),
            concentracion: c.concentracion || null
          }))
        };
      } else {
        finalNombreGenerico = null;
        finalConcentracion = null;
        compuestosConnection = {
          deleteMany: {}
        };
      }
    }

    // 3. Procesar forma farmacéutica
    if (formaFarmaceuticaId !== undefined) {
      activeFormaFarmaceuticaId = formaFarmaceuticaId ? parseInt(formaFarmaceuticaId) : null;
    }

    // 4. Procesar categorías múltiples
    let categoriasConnection: any = undefined;
    if (categoriasIds !== undefined) {
      if (Array.isArray(categoriasIds)) {
        const validIds = categoriasIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        if (validIds.length > 0) {
          categoriasConnection = {
            set: validIds.map(id => ({ id }))
          };
        } else {
          categoriasConnection = { set: [] };
        }
      } else {
        categoriasConnection = { set: [] };
      }
    }

    // 5. Generación y validación de SKU única en memoria
    let finalSku = sku;
    if (finalSku === "") {
      const finalLabNombre = laboratorioNombre !== undefined ? laboratorioNombre : (currentProduct.laboratorio?.nombre || "");
      const baseSku = generateSKU({
        nombreComercial: nombreComercial !== undefined ? nombreComercial : currentProduct.nombreComercial,
        nombreGenerico: finalNombreGenerico !== undefined ? finalNombreGenerico : currentProduct.nombreGenerico,
        concentracion: finalConcentracion !== undefined ? finalConcentracion : currentProduct.concentracion,
        cantidadPresentacion: cantidadPresentacion !== undefined ? (cantidadPresentacion ? parseInt(cantidadPresentacion) : null) : currentProduct.cantidadPresentacion,
      }, finalLabNombre);

      const existingProducts = await prisma.producto.findMany({
        where: { sku: { startsWith: baseSku }, NOT: { id: productoId } },
        select: { sku: true }
      });
      const existingSkusSet = new Set(existingProducts.map(p => p.sku));

      if (!existingSkusSet.has(baseSku)) {
        finalSku = baseSku;
      } else {
        let counter = 1;
        let checkSku = `${baseSku}-${counter}`;
        while (existingSkusSet.has(checkSku)) {
          counter++;
          checkSku = `${baseSku}-${counter}`;
        }
        finalSku = checkSku;
      }
    }

    if (sku && existingSkuProduct) {
      return NextResponse.json({ error: "El SKU ya está registrado por otro producto" }, { status: 400 });
    }

    if (codigoBarras && existingBarcodeProduct) {
      return NextResponse.json({ error: "El Código de Barras ya está registrado por otro producto" }, { status: 400 });
    }

    // ── ACTUALIZAR PRECIOS EN SUCURSALES (SI SE ADJUNTAN) ──────────────────
    if (sucursalId !== undefined) {
      if (sucursalId === "todos") {
        const todasSucursales = await prisma.sucursal.findMany({ select: { id: true } });
        const updateData = {
          precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : undefined,
          precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : undefined,
          precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : undefined,
          costo: costo !== undefined ? parseFloat(costo) : undefined,
        };

        const ops = todasSucursales.map((s) =>
          prisma.inventarioSucursal.upsert({
            where: { productoId_sucursalId: { productoId, sucursalId: s.id } },
            update: updateData,
            create: {
              productoId,
              sucursalId: s.id,
              cantidadTotal: 0,
              precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : 0,
              precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : 0,
              precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : 0,
              costo: costo !== undefined ? parseFloat(costo) : 0,
              stockMinimo: presentacion === "Caja" ? (cantidadPresentacion ? parseInt(cantidadPresentacion) : 100) : 10,
            },
          })
        );
        await prisma.$transaction(ops);
      } else {
        const sId = parseInt(sucursalId);
        if (!isNaN(sId)) {
          await prisma.inventarioSucursal.upsert({
            where: { productoId_sucursalId: { productoId, sucursalId: sId } },
            update: {
              precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : undefined,
              precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : undefined,
              precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : undefined,
              costo: costo !== undefined ? parseFloat(costo) : undefined,
            },
            create: {
              productoId,
              sucursalId: sId,
              cantidadTotal: 0,
              precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : 0,
              precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : 0,
              precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : 0,
              costo: costo !== undefined ? parseFloat(costo) : 0,
              stockMinimo: presentacion === "Caja" ? (cantidadPresentacion ? parseInt(cantidadPresentacion) : 100) : 10,
            },
          });
        }
      }
    }

    // 6. Actualizar Producto y retornar relaciones completas (incluyendo inventarios)
    const finalProducto = await prisma.producto.update({
      where: { id: productoId },
      data: {
        nombreComercial: nombreComercial !== undefined ? nombreComercial : undefined,
        nombreGenerico: finalNombreGenerico !== undefined ? finalNombreGenerico : undefined,
        concentracion: finalConcentracion !== undefined ? finalConcentracion : undefined,
        formaFarmaceuticaId: activeFormaFarmaceuticaId !== undefined ? activeFormaFarmaceuticaId : undefined,
        presentacion: presentacion !== undefined ? presentacion : undefined,
        sku: finalSku !== undefined ? finalSku : undefined,
        codigoBarras: codigoBarras !== undefined ? codigoBarras : undefined,
        laboratorioId: laboratorioId !== undefined ? (laboratorioId ? parseInt(laboratorioId) : null) : undefined,
        cantidadPresentacion: cantidadPresentacion !== undefined ? (cantidadPresentacion ? parseInt(cantidadPresentacion) : null) : undefined,
        cantidadPresentacionBlister: cantidadPresentacionBlister !== undefined ? (cantidadPresentacionBlister ? parseInt(cantidadPresentacionBlister) : null) : undefined,
        contenidoNetoValor: contenidoNetoValor !== undefined ? (contenidoNetoValor ? parseFloat(contenidoNetoValor) : null) : undefined,
        contenidoNetoUnidad: contenidoNetoUnidad !== undefined ? (contenidoNetoUnidad || null) : undefined,
        esGenerico: esGenerico !== undefined ? (esGenerico === true) : undefined,
        compuestos: compuestosConnection,
        categorias: categoriasConnection,
      },
      include: {
        laboratorio: true,
        categorias: true,
        formaFarmaceuticaRel: true,
        compuestos: {
          include: {
            compuesto: true
          }
        },
        inventarios: {
          include: {
            sucursal: {
              select: { nombre: true }
            }
          }
        }
      },
    });

    if (!finalProducto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const parsedProduct = {
      ...finalProducto,
      nombreProducto: getFullProductName(finalProducto),
    };

    return NextResponse.json(parsedProduct);
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/productos/[id] - Eliminar producto del catálogo (Solo Admin)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const productoId = parseInt(id);

    if (isNaN(productoId)) {
      return NextResponse.json(
        { error: "ID de producto inválido" },
        { status: 400 }
      );
    }

    // Eliminar registros dependientes en otras tablas para evitar errores de clave foránea (FK)
    await prisma.$transaction([
      prisma.carritoVentas.deleteMany({ where: { productoId } }),
      prisma.expiracionLote.deleteMany({ where: { productoId } }),
      prisma.kardex.deleteMany({ where: { productoId } }),
      prisma.detalleVenta.deleteMany({ where: { productoId } }),
      prisma.producto.delete({
        where: { id: productoId },
      }),
    ]);

    return NextResponse.json({
      message: "Producto eliminado correctamente de forma física del catálogo global",
    });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
