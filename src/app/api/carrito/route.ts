import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

// GET /api/carrito - Obtener items del carrito para el usuario logueado
export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const idUsuario = parseInt(session.user.id);

    const items = await prisma.carritoVentas.findMany({
      where: {
        idUsuario,
        sucursalId: session.user.sucursalId,
      },
      include: {
        producto: {
          select: {
            nombreComercial: true,
            nombreGenerico: true,
            concentracion: true,
            presentacion: true,
            sku: true,
            codigoBarras: true,
            cantidadPresentacion: true,
            cantidadPresentacionBlister: true,
            categorias: { select: { nombre: true } },
            formaFarmaceuticaRel: { select: { nombre: true } },
            laboratorio: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fecha: "asc" },
    });

    const mappedItems = items.map(item => ({
      ...item,
      producto: {
        ...item.producto,
        nombreProducto: getFullProductName(item.producto)
      }
    }));

    return NextResponse.json(mappedItems);
  } catch (error) {
    console.error("Error al obtener carrito:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/carrito - Agregar un item al carrito (o actualizar cantidad)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const idUsuario = parseInt(session.user.id);
    const sucursalId = session.user.sucursalId;

    const body = await request.json();
    const { productoId, cantidad, precioVenta, tipoVenta } = body;

    if (!productoId || cantidad === undefined || !precioVenta || !tipoVenta) {
      return NextResponse.json(
        { error: "productoId, cantidad, precioVenta y tipoVenta son requeridos" },
        { status: 400 }
      );
    }

    const pId = parseInt(productoId);
    const cant = parseInt(cantidad);
    const precio = parseFloat(precioVenta);

    // Validar si el producto existe
    const producto = await prisma.producto.findUnique({
      where: { id: pId },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    // Verificar si ya existe ese producto en el carrito de este usuario con el mismo TIPO DE VENTA
    // Ej. Si tiene Paracetamol por UNIDAD y agrega otra UNIDAD, se suma. Si agrega Paracetamol por CAJA, es otro registro.
    const itemExistente = await prisma.carritoVentas.findFirst({
      where: {
        idUsuario,
        productoId: pId,
        tipoVenta,
        sucursalId,
      },
    });

    // ── VALIDACIÓN DE STOCK EN TIEMPO REAL ───────────────────────────────────
    const inventario = await prisma.inventarioSucursal.findUnique({
      where: {
        productoId_sucursalId: {
          productoId: pId,
          sucursalId,
        },
      },
    });

    if (!inventario) {
      return NextResponse.json(
        { error: "Este producto no cuenta con inventario registrado en esta sucursal." },
        { status: 400 }
      );
    }

    let factorNuevo = 1;
    if (tipoVenta === "Venta por caja") {
      factorNuevo = producto.cantidadPresentacion || 1;
    } else if (tipoVenta === "Venta por blíster") {
      factorNuevo = producto.cantidadPresentacionBlister || 1;
    }
    const unidadesNuevas = cant * factorNuevo;

    const otrosItemsCarrito = await prisma.carritoVentas.findMany({
      where: {
        idUsuario,
        sucursalId,
        productoId: pId,
        NOT: itemExistente ? { id: itemExistente.id } : undefined,
      },
    });

    const unidadesEnCarritoOtros = otrosItemsCarrito.reduce((acc, item) => {
      let f = 1;
      if (item.tipoVenta === "Venta por caja") {
        f = producto.cantidadPresentacion || 1;
      } else if (item.tipoVenta === "Venta por blíster") {
        f = producto.cantidadPresentacionBlister || 1;
      }
      return acc + item.cantidad * f;
    }, 0);

    const totalUnidadesRequeridas = unidadesEnCarritoOtros + (itemExistente ? (itemExistente.cantidad + cant) : cant) * factorNuevo;

    if (totalUnidadesRequeridas > inventario.cantidadTotal) {
      const disponibles = Math.max(0, inventario.cantidadTotal - unidadesEnCarritoOtros);
      let maximoFormateado = `${disponibles} unidades`;
      if (tipoVenta === "Venta por caja") {
        maximoFormateado = `${Math.floor(disponibles / factorNuevo)} cajas`;
      } else if (tipoVenta === "Venta por blíster") {
        maximoFormateado = `${Math.floor(disponibles / factorNuevo)} blísteres`;
      }
      return NextResponse.json(
        { error: `Stock insuficiente. Solo quedan ${maximoFormateado} disponibles en este formato.` },
        { status: 400 }
      );
    }

    const itemInclude = {
      producto: {
        select: {
          nombreComercial: true,
          nombreGenerico: true,
          concentracion: true,
          presentacion: true,
          sku: true,
          codigoBarras: true,
          cantidadPresentacion: true,
          cantidadPresentacionBlister: true,
          categorias: { select: { nombre: true } },
          formaFarmaceuticaRel: { select: { nombre: true } },
          laboratorio: { select: { nombre: true } },
        },
      },
    } as const;

    if (itemExistente) {
      // Incrementar la cantidad del item existente
      const nuevaCantidad = itemExistente.cantidad + cant;

      if (nuevaCantidad <= 0) {
        // Usar deleteMany para evitar error si ya fue eliminado
        await prisma.carritoVentas.deleteMany({
          where: { id: itemExistente.id },
        });
        return NextResponse.json({ message: "Item eliminado del carrito" });
      }

      const itemActualizado = await prisma.carritoVentas.update({
        where: { id: itemExistente.id },
        data: {
          cantidad: nuevaCantidad,
          precioVenta: precio, // Por si cambió el precio
        },
        include: itemInclude,
      });

      return NextResponse.json({
        ...itemActualizado,
        producto: {
          ...itemActualizado.producto,
          nombreProducto: getFullProductName(itemActualizado.producto as any),
        },
      });
    } else {
      // Crear un nuevo registro en el carrito
      if (cant <= 0) {
        return NextResponse.json(
          { error: "La cantidad debe ser mayor a 0" },
          { status: 400 }
        );
      }

      const nuevoItem = await prisma.carritoVentas.create({
        data: {
          productoId: pId,
          sucursalId,
          idUsuario,
          cantidad: cant,
          precioVenta: precio,
          tipoVenta,
        },
        include: itemInclude,
      });

      return NextResponse.json({
        ...nuevoItem,
        producto: {
          ...nuevoItem.producto,
          nombreProducto: getFullProductName(nuevoItem.producto as any),
        },
      }, { status: 201 });
    }
  } catch (error) {
    console.error("Error al agregar al carrito:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/carrito - Vaciar el carrito completo del vendedor logueado
export async function DELETE() {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const idUsuario = parseInt(session.user.id);

    await prisma.carritoVentas.deleteMany({
      where: {
        idUsuario,
        sucursalId: session.user.sucursalId,
      },
    });

    return NextResponse.json({ message: "Carrito vaciado correctamente" });
  } catch (error) {
    console.error("Error al vaciar el carrito:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
