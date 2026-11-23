import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const ordenId = parseInt(id);
    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const orden = await prisma.ordenCompra.findUnique({
      where: { id: ordenId },
      include: {
        proveedor: { select: { id: true, nombre: true, ruc: true } },
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombreVendedor: true } },
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                nombreComercial: true,
                nombreGenerico: true,
                concentracion: true,
                presentacion: true,
                laboratorio: { select: { nombre: true } },
              },
            },
          },
        },
        ingresos: {
          include: {
            usuario: { select: { id: true, nombreVendedor: true } },
            detalles: {
              include: {
                producto: {
                  select: {
                    id: true,
                    nombreComercial: true,
                    nombreGenerico: true,
                    concentracion: true,
                    presentacion: true,
                    laboratorio: { select: { nombre: true } },
                  },
                },
              },
            },
          },
          orderBy: { fecha: "desc" },
        },
      },
    });

    if (!orden) {
      return NextResponse.json(
        { error: "Orden de compra no encontrada" },
        { status: 404 }
      );
    }

    const computed = {
      ...orden,
      detalles: orden.detalles.map(d => ({
        ...d,
        producto: {
          ...d.producto,
          nombreProducto: getFullProductName(d.producto),
        },
      })),
      ingresos: orden.ingresos.map(i => ({
        ...i,
        detalles: i.detalles.map(d => ({
          ...d,
          producto: {
            ...d.producto,
            nombreProducto: getFullProductName(d.producto),
          },
        })),
      })),
    };
    return NextResponse.json(computed);
  } catch (error) {
    console.error("Error al obtener orden de compra:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

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
    const ordenId = parseInt(id);
    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { estado, observaciones } = body;

    const orden = await prisma.ordenCompra.update({
      where: { id: ordenId },
      data: {
        ...(estado !== undefined && { estado }),
        ...(observaciones !== undefined && { observaciones }),
      },
    });

    return NextResponse.json(orden);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "Orden de compra no encontrada" },
        { status: 404 }
      );
    }
    console.error("Error al actualizar orden de compra:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const ordenId = parseInt(id);
    if (isNaN(ordenId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const orden = await prisma.ordenCompra.findUnique({
      where: { id: ordenId },
      select: { estado: true },
    });
    if (!orden) {
      return NextResponse.json(
        { error: "Orden de compra no encontrada" },
        { status: 404 }
      );
    }
    if (orden.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar órdenes pendientes" },
        { status: 400 }
      );
    }

    await prisma.ordenCompra.delete({ where: { id: ordenId } });

    return NextResponse.json({ message: "Orden de compra eliminada" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "Orden de compra no encontrada" },
        { status: 404 }
      );
    }
    console.error("Error al eliminar orden de compra:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
