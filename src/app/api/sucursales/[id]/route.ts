import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/sucursales/[id] - Obtener detalles de una sucursal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const sucursalId = parseInt(id);

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const sucursal = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
    });

    if (!sucursal) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(sucursal);
  } catch (error) {
    console.error("Error al obtener sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/sucursales/[id] - Actualizar sucursal (Solo Admin)
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
    const sucursalId = parseInt(id);

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombre, direccion, estado } = body;

    const sucursalExistente = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
    });

    if (!sucursalExistente) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    // Si intenta cambiar el nombre, verificar que no choque con otra sucursal
    if (nombre && nombre !== sucursalExistente.nombre) {
      const choque = await prisma.sucursal.findUnique({
        where: { nombre },
      });
      if (choque) {
        return NextResponse.json(
          { error: "Ya existe otra sucursal con ese nombre" },
          { status: 400 }
        );
      }
    }

    const sucursalActualizada = await prisma.sucursal.update({
      where: { id: sucursalId },
      data: {
        nombre: nombre ?? undefined,
        direccion: direccion ?? undefined,
        estado: estado ?? undefined,
      },
    });

    return NextResponse.json(sucursalActualizada);
  } catch (error) {
    console.error("Error al actualizar sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/sucursales/[id] - Desactivación lógica (Solo Admin)
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
    const sucursalId = parseInt(id);

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    // Hacemos borrado lógico (estado: 'inactivo') para mantener integridad histórica
    const sucursalDesactivada = await prisma.sucursal.update({
      where: { id: sucursalId },
      data: { estado: "inactivo" },
    });

    return NextResponse.json({
      message: "Sucursal desactivada correctamente",
      sucursal: sucursalDesactivada,
    });
  } catch (error) {
    console.error("Error al desactivar sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
