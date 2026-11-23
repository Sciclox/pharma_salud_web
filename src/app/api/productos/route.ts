import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName, generateSKU } from "@/lib/productos";

// GET /api/productos - Obtener todos los productos del catálogo central (con soporte para búsqueda)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoria = searchParams.get("categoria") || "";
    const laboratorioId = searchParams.get("laboratorioId") || "";

    // Filtros de búsqueda acumulativos
    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        {
          nombreComercial: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          nombreGenerico: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (categoria) {
      whereClause.categorias = {
        some: {
          nombre: { equals: categoria, mode: "insensitive" },
        },
      };
    }

    if (laboratorioId) {
      whereClause.laboratorioId = {
        equals: parseInt(laboratorioId),
      };
    }

    const productos = await prisma.producto.findMany({
      where: whereClause,
      orderBy: { nombreComercial: "asc" },
      // Incluir información de inventario por sucursal si se solicita
      include: {
        inventarios: true,
        laboratorio: true,
        categorias: true,
        formaFarmaceuticaRel: true,
        compuestos: {
          include: {
            compuesto: true
          }
        },
      },
    });

    const productosConNombre = productos.map(producto => ({
      ...producto,
      nombreProducto: getFullProductName(producto),
    }));

    return NextResponse.json(productosConNombre);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/productos - Agregar producto al catálogo global (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      nombreComercial,
      nombreGenerico,
      compuestos, // array de compuestos
      concentracion,
      formaFarmaceuticaId,
      presentacion,
      sku,
      codigoBarras,
      categoriasIds, // array de ids de categorias
      laboratorioId,
      laboratorioNombre,
      cantidadPresentacion,
      cantidadPresentacionBlister,
      cantidadInicial,
      contenidoNetoValor,
      contenidoNetoUnidad,
      esGenerico,
      precioCaja,
      precioUnidad,
      precioBlister,
      costo,
      sucursalId,
      sucursalesIds,
    } = body;

    // Procesamiento de Compuestos dinámicos (Con Concentración Individual)
    const validCompuestos = compuestos && Array.isArray(compuestos)
      ? compuestos.filter(c => c.compuestoId && c.compuestoId !== "")
      : [];

    let activeFormaFarmaceuticaId = formaFarmaceuticaId ? parseInt(formaFarmaceuticaId) : null;

    let finalNombreGenerico = nombreGenerico || null;
    let finalConcentracion = concentracion || null;

    // Generar baseSku si no hay SKU provisto
    const baseSku = sku ? null : generateSKU({
      nombreComercial,
      nombreGenerico: finalNombreGenerico,
      concentracion: finalConcentracion,
      cantidadPresentacion: cantidadPresentacion ? parseInt(cantidadPresentacion) : null,
    }, laboratorioNombre || "");

    // 1. Ejecutar búsquedas de duplicidad y consulta de SKUs similares en paralelo (ahorrando un viaje de ida y vuelta a la red)
    const [existingSkuProduct, existingBarcodeProduct, existingProducts] = await Promise.all([
      sku ? prisma.producto.findFirst({ where: { sku } }) : Promise.resolve(null),
      codigoBarras ? prisma.producto.findFirst({ where: { codigoBarras } }) : Promise.resolve(null),
      baseSku ? prisma.producto.findMany({
        where: { sku: { startsWith: baseSku } },
        select: { sku: true }
      }) : Promise.resolve([])
    ]);

    if (sku && existingSkuProduct) {
      return NextResponse.json({ error: "El SKU ya está registrado" }, { status: 400 });
    }

    if (codigoBarras && existingBarcodeProduct) {
      return NextResponse.json({ error: "El Código de Barras ya está registrado" }, { status: 400 });
    }

    let compuestosConnection: any = {};

    if (validCompuestos.length > 0) {
      compuestosConnection = {
        create: validCompuestos.map(c => ({
          compuestoId: parseInt(c.compuestoId.toString()),
          concentracion: c.concentracion || null
        }))
      };
    }

    // 2. Resolver Forma Farmacéutica
    // 3. Procesamiento de Categorías múltiples
    let categoriasConnection: any = {};
    if (categoriasIds && Array.isArray(categoriasIds) && categoriasIds.length > 0) {
      const validIds = categoriasIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
      if (validIds.length > 0) {
        categoriasConnection = {
          connect: validIds.map(id => ({ id }))
        };
      }
    }

    if (!nombreComercial && !finalNombreGenerico) {
      return NextResponse.json(
        { error: "El nombre comercial o genérico del producto es requerido" },
        { status: 400 }
      );
    }

    // 4. Generación y validación de SKU única en memoria (usando el resultado paralelo)
    let finalSku = sku;
    if (!finalSku && baseSku) {
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

    // 5. Preparar los datos del inventario inicial
    let inventariosData: any[] = [];
    const activeSucursales = sucursalesIds || [];
    if (activeSucursales.length > 0) {
      const parsedSucursalId = sucursalId && sucursalId !== "todos" ? parseInt(sucursalId) : null;
      inventariosData = activeSucursales.map((sId: number) => {
        const isTarget = parsedSucursalId === null || sId === parsedSucursalId;
        return {
          sucursalId: sId,
          cantidadTotal: isTarget && cantidadInicial !== undefined ? parseInt(cantidadInicial) : 0,
          precioCaja: isTarget && precioCaja !== undefined ? parseFloat(precioCaja) : 0,
          precioUnidad: isTarget && precioUnidad !== undefined ? parseFloat(precioUnidad) : 0,
          precioBlister: isTarget && precioBlister !== undefined ? parseFloat(precioBlister) : 0,
          costo: isTarget && costo !== undefined ? parseFloat(costo) : 0,
          stockMinimo: presentacion === "Caja" ? (cantidadPresentacion ? parseInt(cantidadPresentacion) : 100) : 10,
        };
      });
    }

    // 6. Insertar Producto y sus inventarios asociados en una sola operación atómica
    const finalProducto = await prisma.producto.create({
      data: {
        nombreComercial: nombreComercial || null,
        nombreGenerico: finalNombreGenerico || null,
        concentracion: finalConcentracion || null,
        formaFarmaceuticaId: activeFormaFarmaceuticaId,
        presentacion: presentacion || null,
        sku: finalSku || null,
        codigoBarras: codigoBarras || null,
        laboratorioId: laboratorioId ? parseInt(laboratorioId) : null,
        cantidadPresentacion: cantidadPresentacion ? parseInt(cantidadPresentacion) : null,
        cantidadPresentacionBlister: cantidadPresentacionBlister ? parseInt(cantidadPresentacionBlister) : null,
        contenidoNetoValor: contenidoNetoValor ? parseFloat(contenidoNetoValor) : null,
        contenidoNetoUnidad: contenidoNetoUnidad || null,
        esGenerico: esGenerico === true,
        compuestos: compuestosConnection,
        categorias: categoriasConnection,
        inventarios: {
          create: inventariosData
        }
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

    return NextResponse.json(parsedProduct, { status: 201 });
  } catch (error) {
    console.error("Error al crear producto global:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
