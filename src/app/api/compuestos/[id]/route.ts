import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// PUT /api/compuestos/[id] - Actualizar compuesto (Solo Admin)
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
    const compuestoId = parseInt(id);

    if (isNaN(compuestoId)) {
      return NextResponse.json(
        { error: "ID de compuesto inválido" },
        { status: 400 }
      );
    }

    const compuestoExistente = await prisma.compuesto.findUnique({
      where: { id: compuestoId },
    });

    if (!compuestoExistente) {
      return NextResponse.json(
        { error: "Compuesto no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { nombre } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre del compuesto es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar duplicados excluyendo el compuesto actual
    const duplicado = await prisma.compuesto.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
        NOT: {
          id: compuestoId,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: "Ya existe otro compuesto con este nombre" },
        { status: 400 }
      );
    }

    const compuestoActualizado = await prisma.compuesto.update({
      where: { id: compuestoId },
      data: {
        nombre: nombreNormalizado,
      },
    });

    return NextResponse.json(compuestoActualizado);
  } catch (error) {
    console.error("Error al actualizar compuesto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/compuestos/[id] - Eliminar compuesto (Solo Admin)
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
    const compuestoId = parseInt(id);

    if (isNaN(compuestoId)) {
      return NextResponse.json(
        { error: "ID de compuesto inválido" },
        { status: 400 }
      );
    }

    const compuesto = await prisma.compuesto.findUnique({
      where: { id: compuestoId },
    });

    if (!compuesto) {
      return NextResponse.json(
        { error: "Compuesto no encontrado" },
        { status: 404 }
      );
    }

    const productosAsociados = await prisma.productoCompuesto.count({
      where: { compuestoId: compuestoId },
    });

    if (productosAsociados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el compuesto porque está asociado a ${productosAsociados} producto(s). Retira este compuesto de los productos primero.`,
        },
        { status: 400 }
      );
    }

    await prisma.compuesto.delete({
      where: { id: compuestoId },
    });

    return NextResponse.json({
      message: "Compuesto eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar compuesto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
