import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { analizarInventarioSucursal } from "@/lib/analytics-engine";

// GET /api/analisis - Obtener análisis predictivo de inventario para una sucursal (?sucursalId=X)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sucursalIdParam = searchParams.get("sucursalId");

    if (!sucursalIdParam) {
      return NextResponse.json(
        { error: "El parámetro sucursalId es requerido" },
        { status: 400 }
      );
    }

    const sucursalId = parseInt(sucursalIdParam);
    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const reportePredictivo = await analizarInventarioSucursal(sucursalId);

    return NextResponse.json(reportePredictivo);
  } catch (error) {
    console.error("Error al procesar análisis predictivo:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
