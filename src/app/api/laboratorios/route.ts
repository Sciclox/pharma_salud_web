import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/laboratorios - Obtener todos los laboratorios ordenados alfabéticamente
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const laboratorios = await prisma.laboratorio.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(laboratorios);
  } catch (error) {
    console.error("Error al obtener laboratorios:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/laboratorios - Crear un laboratorio (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, descripcion } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "El nombre del laboratorio es requerido" },
        { status: 400 }
      );
    }

    const nombreNormalizado = nombre.trim();

    // Validar si existe duplicado (insensitivo a mayúsculas/minúsculas)
    const laboratorioExistente = await prisma.laboratorio.findFirst({
      where: {
        nombre: {
          equals: nombreNormalizado,
          mode: "insensitive",
        },
      },
    });

    if (laboratorioExistente) {
      return NextResponse.json(
        { error: "Ya existe un laboratorio con este nombre" },
        { status: 400 }
      );
    }

    const nuevoLaboratorio = await prisma.laboratorio.create({
      data: {
        nombre: nombreNormalizado,
        descripcion: descripcion?.trim() || null,
        estado: "activo",
      },
    });

    return NextResponse.json(nuevoLaboratorio, { status: 201 });
  } catch (error) {
    console.error("Error al crear laboratorio:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
