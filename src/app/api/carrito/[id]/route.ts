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

    // ── VALIDACIÓN DE STOCK EN TIEMPO REAL ───────────────────────────────────
    if (nuevaCantidad > 0) {
      const producto = await prisma.producto.findUnique({
        where: { id: item.productoId },
      });

      if (!producto) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      }

      const inventario = await prisma.inventarioSucursal.findUnique({
        where: {
          productoId_sucursalId: {
            productoId: item.productoId,
            sucursalId: item.sucursalId,
          },
        },
      });

      if (!inventario) {
        return NextResponse.json({ error: "Inventario no encontrado para este producto." }, { status: 404 });
      }

      let factor = 1;
      if (item.tipoVenta === "Venta por caja") {
        factor = producto.cantidadPresentacion || 1;
      } else if (item.tipoVenta === "Venta por blíster") {
        factor = producto.cantidadPresentacionBlister || 1;
      }

      const otrosItems = await prisma.carritoVentas.findMany({
        where: {
          idUsuario: item.idUsuario,
          sucursalId: item.sucursalId,
          productoId: item.productoId,
          NOT: { id: itemId },
        },
      });

      const unidadesOtros = otrosItems.reduce((acc, current) => {
        let f = 1;
        if (current.tipoVenta === "Venta por caja") {
          f = producto.cantidadPresentacion || 1;
        } else if (current.tipoVenta === "Venta por blíster") {
          f = producto.cantidadPresentacionBlister || 1;
        }
        return acc + current.cantidad * f;
      }, 0);

      const totalUnidadesRequeridas = unidadesOtros + nuevaCantidad * factor;

      if (totalUnidadesRequeridas > inventario.cantidadTotal) {
        const disponibles = Math.max(0, inventario.cantidadTotal - unidadesOtros);
        let maximoFormateado = `${disponibles} unidades`;
        if (item.tipoVenta === "Venta por caja") {
          maximoFormateado = `${Math.floor(disponibles / factor)} cajas`;
        } else if (item.tipoVenta === "Venta por blíster") {
          maximoFormateado = `${Math.floor(disponibles / factor)} blísteres`;
        }
        return NextResponse.json(
          { error: `Stock insuficiente. Solo quedan ${maximoFormateado} disponibles.` },
          { status: 400 }
        );
      }
    }

    if (nuevaCantidad <= 0) {
      // Usar deleteMany para evitar error si el item ya fue eliminado
      await prisma.carritoVentas.deleteMany({
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
      return NextResponse.json({ message: "El item ya no existe en el carrito" });
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
