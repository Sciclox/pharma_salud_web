import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/unidades-medida - Obtener todas las unidades ordenadas alfabéticamente
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const unidades = await prisma.unidadMedida.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(unidades);
  } catch (error) {
    console.error("Error al obtener unidades de medida:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/unidades-medida - Crear una unidad de medida (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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

    // Validar si existe duplicado (insensitivo)
    const unidadExistente = await prisma.unidadMedida.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
      },
    });

    if (unidadExistente) {
      return NextResponse.json(
        { error: "Ya existe esta unidad de medida" },
        { status: 400 }
      );
    }

    const nuevaUnidad = await prisma.unidadMedida.create({
      data: {
        nombre: nombreNormalizado,
      },
    });

    return NextResponse.json(nuevaUnidad, { status: 201 });
  } catch (error) {
    console.error("Error al crear unidad de medida:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
