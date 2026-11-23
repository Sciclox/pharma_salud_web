import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(proveedores);
  } catch (error) {
    console.error("Error al listar proveedores:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, ruc, direccion, telefono, email, contacto } = body;

    if (!nombre || nombre.trim() === "") {
      return NextResponse.json(
        { error: "El nombre del proveedor es obligatorio" },
        { status: 400 }
      );
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        nombre: nombre.trim(),
        ruc: ruc?.trim() || null,
        direccion: direccion?.trim() || null,
        telefono: telefono?.trim() || null,
        email: email?.trim() || null,
        contacto: contacto?.trim() || null,
      },
    });

    return NextResponse.json(proveedor, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un proveedor con ese nombre o RUC" },
        { status: 409 }
      );
    }
    console.error("Error al crear proveedor:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
