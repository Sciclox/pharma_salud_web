import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/ventas - Historial de ventas con filtros
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fechaInicioStr = searchParams.get("fechaInicio");
    const fechaFinStr = searchParams.get("fechaFin");
    const usuarioIdParam = searchParams.get("usuarioId");
    const sucursalIdParam = searchParams.get("sucursalId");

    const whereClause: any = {};

    // 1. Filtrar por sucursal según rol
    if (session.user.role === "Vendedor") {
      if (!session.user.sucursalId) {
        return NextResponse.json({ error: "Vendedor sin sucursal asignada" }, { status: 400 });
      }
      whereClause.sucursalId = session.user.sucursalId;
    } else {
      // Si es Admin, puede filtrar por una sucursal específica o ver todas
      if (sucursalIdParam) {
        whereClause.sucursalId = parseInt(sucursalIdParam);
      }
    }

    // 2. Filtrar por vendedor
    if (usuarioIdParam) {
      whereClause.usuarioId = parseInt(usuarioIdParam);
    }

    // 3. Filtrar por rango de fechas (con soporte de zona horaria UTC-5 Perú)
    if (fechaInicioStr && fechaFinStr) {
      // Las fechas llegan como strings YYYY-MM-DD en hora LOCAL (UTC-5)
      // Para buscar correctamente en Postgres (UTC), debemos desplazar +5h
      const OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5 → sumar 5h para pasar a UTC

      const inicio = new Date(`${fechaInicioStr}T00:00:00.000Z`);
      inicio.setTime(inicio.getTime() + OFFSET_MS); // inicio del día local en UTC

      const fin = new Date(`${fechaFinStr}T23:59:59.999Z`);
      fin.setTime(fin.getTime() + OFFSET_MS); // fin del día local en UTC

      whereClause.fecha = {
        gte: inicio,
        lte: fin,
      };
    } else if (fechaInicioStr) {
      const OFFSET_MS = 5 * 60 * 60 * 1000;
      const inicio = new Date(`${fechaInicioStr}T00:00:00.000Z`);
      inicio.setTime(inicio.getTime() + OFFSET_MS);
      whereClause.fecha = {
        gte: inicio,
      };
    }


    const ventas = await prisma.registroVentas.findMany({
      where: whereClause,
      include: {
        usuario: {
          select: { nombreVendedor: true },
        },
        sucursal: {
          select: { nombre: true },
        },
        detalles: {
          include: {
            producto: {
              select: { categoriaId: true },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(ventas);
  } catch (error) {
    console.error("Error al obtener historial de ventas:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
