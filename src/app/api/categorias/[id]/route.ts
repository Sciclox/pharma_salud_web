import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// PUT /api/categorias/[id] - Actualizar categoría (Solo Admin)
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
    const categoriaId = parseInt(id);

    if (isNaN(categoriaId)) {
      return NextResponse.json(
        { error: "ID de categoría inválido" },
        { status: 400 }
      );
    }

    const categoriaExistente = await prisma.categoria.findUnique({
      where: { id: categoriaId },
    });

    if (!categoriaExistente) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { nombre, descripcion, estado } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre de la categoría es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar duplicados excluyendo la categoría actual
    const duplicado = await prisma.categoria.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
        NOT: {
          id: categoriaId,
        },
      },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: "Ya existe otra categoría con este nombre" },
        { status: 400 }
      );
    }

    const categoriaActualizada = await prisma.categoria.update({
      where: { id: categoriaId },
      data: {
        nombre: nombreNormalizado,
        descripcion: descripcion?.trim() || null,
        estado: estado ?? undefined,
      },
    });

    return NextResponse.json(categoriaActualizada);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/categorias/[id] - Eliminar categoría (Solo Admin)
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
    const categoriaId = parseInt(id);

    if (isNaN(categoriaId)) {
      return NextResponse.json(
        { error: "ID de categoría inválido" },
        { status: 400 }
      );
    }

    const categoria = await prisma.categoria.findUnique({
      where: { id: categoriaId },
    });

    if (!categoria) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      );
    }

    const productosAsociados = await prisma.producto.count({
      where: { categorias: { some: { id: categoriaId } } },
    });

    if (productosAsociados > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar la categoría porque tiene ${productosAsociados} producto(s) asociado(s). Cambia de categoría a esos productos primero.` },
        { status: 400 }
      );
    }

    await prisma.categoria.delete({
      where: { id: categoriaId },
    });

    return NextResponse.json({
      message: "Categoría eliminada correctamente de forma física",
    });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
