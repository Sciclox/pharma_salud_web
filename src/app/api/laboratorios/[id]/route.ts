import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// PUT /api/laboratorios/[id] - Actualizar laboratorio (Solo Admin)
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
    const laboratorioId = parseInt(id);

    if (isNaN(laboratorioId)) {
      return NextResponse.json(
        { error: "ID de laboratorio inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombre, descripcion, estado } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre del laboratorio es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar duplicados excluyendo el laboratorio actual
    const duplicado = await prisma.laboratorio.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
        NOT: {
          id: laboratorioId,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: "Ya existe otro laboratorio con este nombre" },
        { status: 400 }
      );
    }

    const laboratorioActualizado = await prisma.laboratorio.update({
      where: { id: laboratorioId },
      data: {
        nombre: nombreNormalizado,
        descripcion: descripcion?.trim() || null,
        estado: estado ?? undefined,
      },
    });

    return NextResponse.json(laboratorioActualizado);
  } catch (error) {
    console.error("Error al actualizar laboratorio:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/laboratorios/[id] - Eliminar laboratorio (Solo Admin)
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
    const laboratorioId = parseInt(id);

    if (isNaN(laboratorioId)) {
      return NextResponse.json(
        { error: "ID de laboratorio inválido" },
        { status: 400 }
      );
    }

    const laboratorio = await prisma.laboratorio.findUnique({
      where: { id: laboratorioId },
    });

    if (!laboratorio) {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    await prisma.laboratorio.delete({
      where: { id: laboratorioId },
    });

    return NextResponse.json({
      message: "Laboratorio eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar laboratorio:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
