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

    // 3. Filtrar por rango de fechas (con soporte de zona horaria)
    if (fechaInicioStr && fechaFinStr) {
      const inicio = new Date(fechaInicioStr);
      const fin = new Date(fechaFinStr);
      // Forzar que el fin de día sea hasta las 23:59:59
      fin.setHours(23, 59, 59, 999);

      whereClause.fecha = {
        gte: inicio,
        lte: fin,
      };
    } else if (fechaInicioStr) {
      // Filtrar desde una fecha específica
      whereClause.fecha = {
        gte: new Date(fechaInicioStr),
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
              select: { tipoProducto: true },
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
