import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/compuestos - Obtener todos los compuestos ordenados alfabéticamente
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const compuestos = await prisma.compuesto.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(compuestos);
  } catch (error) {
    console.error("Error al obtener compuestos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/compuestos - Crear un compuesto (Solo Admin)
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
        { error: "El nombre del compuesto es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar si existe duplicado (insensitivo)
    const compuestoExistente = await prisma.compuesto.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
      },
    });

    if (compuestoExistente) {
      return NextResponse.json(
        { error: "Ya existe un compuesto con este nombre" },
        { status: 400 }
      );
    }

    const nuevoCompuesto = await prisma.compuesto.create({
      data: {
        nombre: nombreNormalizado,
      },
    });

    return NextResponse.json(nuevoCompuesto, { status: 201 });
  } catch (error) {
    console.error("Error al crear compuesto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
