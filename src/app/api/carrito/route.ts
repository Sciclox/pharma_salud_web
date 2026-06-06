import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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
            nombreProducto: true,
            tipoProducto: true,
            cantidadPresentacion: true,
            cantidadPresentacionBlister: true,
          },
        },
      },
      orderBy: { fecha: "asc" },
    });

    return NextResponse.json(items);
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

    if (itemExistente) {
      // Incrementar la cantidad del item existente
      const nuevaCantidad = itemExistente.cantidad + cant;

      if (nuevaCantidad <= 0) {
        // Si el cliente reduce la cantidad a 0 o menos, borrar el item
        await prisma.carritoVentas.delete({
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
      });

      return NextResponse.json(itemActualizado);
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
      });

      return NextResponse.json(nuevoItem, { status: 201 });
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
