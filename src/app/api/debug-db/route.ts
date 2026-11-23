import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Activar al usuario 'admin' automáticamente
    await prisma.usuario.updateMany({
      where: {
        nombreUsuario: "admin",
      },
      data: {
        estado: "activo",
      },
    });

    // 2. Traer el listado actualizado de usuarios
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombreUsuario: true,
        nombreVendedor: true,
        rol: true,
        estado: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "¡Usuario 'admin' reactivado con éxito a estado 'activo'!",
      totalUsuarios: usuarios.length,
      usuarios,
    });
  } catch (error: any) {
    console.error("Error en debug-db:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Error al reactivar el usuario admin.",
    });
  }
}
