import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// PUT /api/carrito/[id] - Actualizar cantidad o precio de un item del carrito
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "ID de item inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { cantidad, precioVenta } = body;

    const item = await prisma.carritoVentas.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item del carrito no encontrado" },
        { status: 404 }
      );
    }

    // Validar propiedad del item (solo el usuario creador puede modificarlo)
    if (item.idUsuario !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const nuevaCantidad = cantidad !== undefined ? parseInt(cantidad) : item.cantidad;

    if (nuevaCantidad <= 0) {
      // Si la cantidad se reduce a 0 o menos, borrar el item
      await prisma.carritoVentas.delete({
        where: { id: itemId },
      });
      return NextResponse.json({ message: "Item eliminado del carrito" });
    }

    const itemActualizado = await prisma.carritoVentas.update({
      where: { id: itemId },
      data: {
        cantidad: nuevaCantidad,
        precioVenta: precioVenta !== undefined ? parseFloat(precioVenta) : undefined,
      },
    });

    return NextResponse.json(itemActualizado);
  } catch (error) {
    console.error("Error al actualizar item del carrito:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/carrito/[id] - Eliminar un item específico del carrito
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const itemId = parseInt(id);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: "ID de item inválido" },
        { status: 400 }
      );
    }

    const item = await prisma.carritoVentas.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item del carrito no encontrado" },
        { status: 404 }
      );
    }

    // Validar propiedad del item
    if (item.idUsuario !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await prisma.carritoVentas.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ message: "Item eliminado del carrito" });
  } catch (error) {
    console.error("Error al eliminar item del carrito:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
