import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// PUT /api/formas-farmaceuticas/[id] - Actualizar forma farmacéutica (Solo Admin)
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
    const formaId = parseInt(id);

    if (isNaN(formaId)) {
      return NextResponse.json(
        { error: "ID de forma farmacéutica inválido" },
        { status: 400 }
      );
    }

    const formaExistente = await prisma.formaFarmaceutica.findUnique({
      where: { id: formaId },
    });

    if (!formaExistente) {
      return NextResponse.json(
        { error: "Forma farmacéutica no encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { nombre, estado } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre de la forma farmacéutica es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar duplicados excluyendo la forma actual
    const duplicado = await prisma.formaFarmaceutica.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
        NOT: {
          id: formaId,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: "Ya existe otra forma farmacéutica con este nombre" },
        { status: 400 }
      );
    }

    const formaActualizada = await prisma.formaFarmaceutica.update({
      where: { id: formaId },
      data: {
        nombre: nombreNormalizado,
        estado: estado ?? undefined,
      },
    });

    return NextResponse.json(formaActualizada);
  } catch (error) {
    console.error("Error al actualizar forma farmacéutica:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/formas-farmaceuticas/[id] - Eliminar forma farmacéutica (Solo Admin)
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
    const formaId = parseInt(id);

    if (isNaN(formaId)) {
      return NextResponse.json(
        { error: "ID de forma farmacéutica inválido" },
        { status: 400 }
      );
    }

    const forma = await prisma.formaFarmaceutica.findUnique({
      where: { id: formaId },
    });

    if (!forma) {
      return NextResponse.json(
        { error: "Forma farmacéutica no encontrada" },
        { status: 404 }
      );
    }

    const productosAsociados = await prisma.producto.count({
      where: { formaFarmaceuticaId: formaId },
    });

    if (productosAsociados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar la forma farmacéutica porque tiene ${productosAsociados} producto(s) asociado(s). Cambia la forma farmacéutica de esos productos primero.`,
        },
        { status: 400 }
      );
    }

    await prisma.formaFarmaceutica.delete({
      where: { id: formaId },
    });

    return NextResponse.json({
      message: "Forma farmacéutica eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar forma farmacéutica:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
