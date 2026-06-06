import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/sucursales - Listar todas las sucursales
export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const sucursales = await prisma.sucursal.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(sucursales);
  } catch (error) {
    console.error("Error al obtener sucursales:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/sucursales - Crear una sucursal (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, direccion } = body;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre de la sucursal es requerido" },
        { status: 400 }
      );
    }

    // Verificar si ya existe una sucursal con el mismo nombre
    const existe = await prisma.sucursal.findUnique({
      where: { nombre },
    });

    if (existe) {
      return NextResponse.json(
        { error: "Ya existe una sucursal con ese nombre" },
        { status: 400 }
      );
    }

    const nuevaSucursal = await prisma.sucursal.create({
      data: {
        nombre,
        direccion,
        estado: "activo",
      },
    });

    return NextResponse.json(nuevaSucursal, { status: 201 });
  } catch (error) {
    console.error("Error al crear sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
