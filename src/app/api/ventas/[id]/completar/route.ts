import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { completarVenta } from "@/lib/ventas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const ventaId = parseInt(id);

    if (isNaN(ventaId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const resultado = await completarVenta(ventaId);

    return NextResponse.json({ success: true, ...resultado });
  } catch (error: any) {
    console.error("Error al completar venta:", error);
    return NextResponse.json(
      { error: error.message || "Error al completar la venta" },
      { status: 400 }
    );
  }
}

