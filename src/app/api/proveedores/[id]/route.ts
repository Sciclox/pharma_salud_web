import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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
    const proveedorId = parseInt(id);
    if (isNaN(proveedorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { nombre, ruc, direccion, telefono, email, contacto, estado } = body;

    const proveedor = await prisma.proveedor.update({
      where: { id: proveedorId },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(ruc !== undefined && { ruc: ruc?.trim() || null }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
        ...(telefono !== undefined && { telefono: telefono?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(contacto !== undefined && { contacto: contacto?.trim() || null }),
        ...(estado !== undefined && { estado }),
      },
    });

    return NextResponse.json(proveedor);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }
    console.error("Error al actualizar proveedor:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const proveedorId = parseInt(id);
    if (isNaN(proveedorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const ordenesAsociadas = await prisma.ordenCompra.count({
      where: { proveedorId },
    });

    if (ordenesAsociadas > 0) {
      return NextResponse.json({
        error: `No se puede eliminar el proveedor porque tiene ${ordenesAsociadas} orden(es) de compra asociada(s). Elimine esas órdenes primero.`,
      }, { status: 409 });
    }

    await prisma.proveedor.delete({ where: { id: proveedorId } });

    return NextResponse.json({ message: "Proveedor eliminado correctamente" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }
    console.error("Error al eliminar proveedor:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
