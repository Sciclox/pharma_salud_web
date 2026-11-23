import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recalcularTodosLosStocksMinimos } from "@/lib/stock";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const countUpdated = await recalcularTodosLosStocksMinimos();

    return NextResponse.json({
      success: true,
      mensaje: `Se recalcularon y actualizaron con éxito ${countUpdated} registros de stock mínimo en todas las sucursales.`,
      registrosActualizados: countUpdated,
    });
  } catch (error) {
    console.error("Error al recalcular stock mínimo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

