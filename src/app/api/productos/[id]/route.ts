import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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

    return NextResponse.json(producto);
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
      tipoProducto,
      laboratorioId,
      cantidadPresentacion,
      cantidadPresentacionBlister,
    } = body;

    const productoActualizado = await prisma.producto.update({
      where: { id: productoId },
      data: {
        nombreProducto: nombreProducto ?? undefined,
        tipoProducto: tipoProducto ?? undefined,
        laboratorioId: laboratorioId !== undefined ? (laboratorioId ? parseInt(laboratorioId) : null) : undefined,
        cantidadPresentacion: cantidadPresentacion !== undefined ? (cantidadPresentacion ? parseInt(cantidadPresentacion) : null) : undefined,
        cantidadPresentacionBlister: cantidadPresentacionBlister !== undefined ? (cantidadPresentacionBlister ? parseInt(cantidadPresentacionBlister) : null) : undefined,
      },
      include: {
        laboratorio: true,
      },
    });

    return NextResponse.json(productoActualizado);
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
