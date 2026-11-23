import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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
    const arqueoId = parseInt(id);

    if (isNaN(arqueoId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const arqueo = await prisma.sobranteCaja.findUnique({
      where: { id: arqueoId },
    });

    if (!arqueo) {
      return NextResponse.json(
        { error: "Registro de arqueo no encontrado" },
        { status: 404 }
      );
    }

    await prisma.sobranteCaja.delete({
      where: { id: arqueoId },
    });

    return NextResponse.json({
      message: "Arqueo eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar arqueo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
