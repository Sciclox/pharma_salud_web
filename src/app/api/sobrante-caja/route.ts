import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/sobrante-caja - Historial de arqueos de caja
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
      whereClause.idUsuario = parseInt(session.user.id);
      whereClause.sucursalId = session.user.sucursalId;
    } else {
      // Admin
      if (sucursalIdParam) {
        whereClause.sucursalId = parseInt(sucursalIdParam);
      }
      if (usuarioIdParam) {
        whereClause.usuarioId = parseInt(usuarioIdParam);
      }
    }

    // 2. Filtro de fechas
    if (fechaInicioStr && fechaFinStr) {
      const inicio = new Date(fechaInicioStr);
      const fin = new Date(fechaFinStr);
      fin.setHours(23, 59, 59, 999);

      whereClause.fecha = {
        gte: inicio,
        lte: fin,
      };
    }

    const sobrantes = await prisma.sobranteCaja.findMany({
      where: whereClause,
      include: {
        usuario: {
          select: { nombreVendedor: true },
        },
        sucursal: {
          select: { nombre: true },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(sobrantes);
  } catch (error) {
    console.error("Error al obtener sobrantes de caja:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/sobrante-caja - Registrar un arqueo de caja (Vendedor o Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const idUsuario = parseInt(session.user.id);
    const sucursalId = session.user.sucursalId;

    const body = await request.json();
    const { monto, nota } = body;

    if (monto === undefined) {
      return NextResponse.json(
        { error: "El monto del arqueo (sobrante/faltante) es requerido" },
        { status: 400 }
      );
    }

    const montoNum = parseFloat(monto);

    const nuevoSobrante = await prisma.sobranteCaja.create({
      data: {
        sucursalId,
        usuarioId: idUsuario,
        monto: montoNum,
        nota: nota || "",
      },
    });

    return NextResponse.json(nuevoSobrante, { status: 201 });
  } catch (error) {
    console.error("Error al crear arqueo de caja:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
