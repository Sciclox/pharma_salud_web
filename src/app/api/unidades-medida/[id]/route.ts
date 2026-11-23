import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// PUT /api/unidades-medida/[id] - Actualizar unidad de medida (Solo Admin)
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
    const unidadId = parseInt(id);

    if (isNaN(unidadId)) {
      return NextResponse.json(
        { error: "ID de unidad de medida inválido" },
        { status: 400 }
      );
    }

    const unidadExistente = await prisma.unidadMedida.findUnique({
      where: { id: unidadId },
    });

    if (!unidadExistente) {
      return NextResponse.json(
        { error: "Unidad de medida no encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { nombre } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre de la unidad de medida es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar duplicados excluyendo la unidad actual
    const duplicado = await prisma.unidadMedida.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
        NOT: {
          id: unidadId,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: "Ya existe otra unidad de medida con este nombre" },
        { status: 400 }
      );
    }

    const unidadActualizada = await prisma.unidadMedida.update({
      where: { id: unidadId },
      data: {
        nombre: nombreNormalizado,
      },
    });

    return NextResponse.json(unidadActualizada);
  } catch (error) {
    console.error("Error al actualizar unidad de medida:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/unidades-medida/[id] - Eliminar unidad de medida (Solo Admin)
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
    const unidadId = parseInt(id);

    if (isNaN(unidadId)) {
      return NextResponse.json(
        { error: "ID de unidad de medida inválido" },
        { status: 400 }
      );
    }

    const unidad = await prisma.unidadMedida.findUnique({
      where: { id: unidadId },
    });

    if (!unidad) {
      return NextResponse.json(
        { error: "Unidad de medida no encontrada" },
        { status: 404 }
      );
    }

    // Comprobar si la unidad se está usando en algún producto (como string de contenidoNetoUnidad)
    const productosAsociados = await prisma.producto.count({
      where: { contenidoNetoUnidad: unidad.nombre },
    });

    if (productosAsociados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar la unidad de medida porque está en uso en ${productosAsociados} producto(s) (bajo Contenido Neto). Modifica esos productos antes de borrarla.`,
        },
        { status: 400 }
      );
    }

    await prisma.unidadMedida.delete({
      where: { id: unidadId },
    });

    return NextResponse.json({
      message: "Unidad de medida eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar unidad de medida:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
