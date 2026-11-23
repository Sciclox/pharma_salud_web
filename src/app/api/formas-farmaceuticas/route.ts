import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/formas-farmaceuticas - Obtener todas las formas farmacéuticas ordenadas alfabéticamente
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formas = await prisma.formaFarmaceutica.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(formas);
  } catch (error) {
    console.error("Error al obtener formas farmacéuticas:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/formas-farmaceuticas - Crear una forma farmacéutica (Solo Admin)
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
        { error: "El nombre de la forma farmacéutica es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar si existe duplicado (insensitivo)
    const formaExistente = await prisma.formaFarmaceutica.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
      },
    });

    if (formaExistente) {
      return NextResponse.json(
        { error: "Ya existe una forma farmacéutica con este nombre" },
        { status: 400 }
      );
    }

    const nuevaForma = await prisma.formaFarmaceutica.create({
      data: {
        nombre: nombreNormalizado,
        estado: "activo",
      },
    });

    return NextResponse.json(nuevaForma, { status: 201 });
  } catch (error) {
    console.error("Error al crear forma farmacéutica:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
