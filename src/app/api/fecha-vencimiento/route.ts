import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/fecha-vencimiento - Listar lotes de vencimiento con filtros
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const diasProximosParam = searchParams.get("diasProximos");
    const soloVencidosParam = searchParams.get("soloVencidos") === "true";
    const sucursalIdParam = searchParams.get("sucursalId");

    const whereClause: any = {};

    // 1. Filtrar por sucursal según rol
    if (session.user.role === "Vendedor") {
      if (!session.user.sucursalId) {
        return NextResponse.json({ error: "Vendedor sin sucursal asignada" }, { status: 400 });
      }
      whereClause.sucursalId = session.user.sucursalId;
    } else {
      if (sucursalIdParam) {
        whereClause.sucursalId = parseInt(sucursalIdParam);
      }
    }

    // 2. Filtro de fechas (Vencidos vs Próximos a vencer)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (soloVencidosParam) {
      // Vencidos: fechaVencimiento < hoy
      whereClause.fechaVencimiento = {
        lt: hoy,
      };
    } else if (diasProximosParam) {
      // Próximos a vencer: hoy <= fechaVencimiento <= hoy + N días
      const dias = parseInt(diasProximosParam);
      if (!isNaN(dias)) {
        const fechaLimite = new Date();
        fechaLimite.setDate(hoy.getDate() + dias);
        fechaLimite.setHours(23, 59, 59, 999);

        whereClause.fechaVencimiento = {
          gte: hoy,
          lte: fechaLimite,
        };
      }
    }

    const lotes = await prisma.expiracionLote.findMany({
      where: whereClause,
      include: {
        producto: {
          select: {
            nombreProducto: true,
            tipoProducto: true,
          },
        },
        sucursal: {
          select: { nombre: true },
        },
      },
      orderBy: { fechaVencimiento: "asc" }, // Los que vencen antes van primero
    });

    return NextResponse.json(lotes);
  } catch (error) {
    console.error("Error al obtener vencimientos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/fecha-vencimiento - Registrar un nuevo lote de vencimiento (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { productoId, sucursalId, fechaVencimiento, cantidad } = body;

    if (!productoId || !sucursalId || !fechaVencimiento || cantidad === undefined) {
      return NextResponse.json(
        { error: "productoId, sucursalId, fechaVencimiento y cantidad son requeridos" },
        { status: 400 }
      );
    }

    const pId = parseInt(productoId);
    const sId = parseInt(sucursalId);
    const cant = parseInt(cantidad);

    if (cant <= 0) {
      return NextResponse.json(
        { error: "La cantidad del lote debe ser mayor a cero" },
        { status: 400 }
      );
    }

    const fecha = new Date(fechaVencimiento);
    if (isNaN(fecha.getTime())) {
      return NextResponse.json(
        { error: "Formato de fecha de vencimiento inválido" },
        { status: 400 }
      );
    }

    // Registrar el lote en la base de datos
    const nuevoLote = await prisma.expiracionLote.create({
      data: {
        productoId: pId,
        sucursalId: sId,
        fechaVencimiento: fecha,
        cantidad: cant,
      },
    });

    // Opcional: Al ingresar un lote, se debería reabastecer automáticamente el stock en inventario_sucursal
    // si el administrador lo está registrando como una entrada. Sin embargo, en el POS original
    // el lote se ingresa junto con un registro de Kardex de tipo 'Ingreso'. Para consistencia,
    // actualizaremos el stock físico de la sucursal también aquí de forma automática.
    await prisma.inventarioSucursal.upsert({
      where: {
        productoId_sucursalId: {
          productoId: pId,
          sucursalId: sId,
        },
      },
      update: {
        cantidadTotal: {
          increment: cant,
        },
      },
      create: {
        productoId: pId,
        sucursalId: sId,
        cantidadTotal: cant,
        precioCaja: 0,
        precioUnidad: 0,
        costoCaja: 0,
        costoUnidad: 0,
        stockMinimo: 0,
      },
    });

    return NextResponse.json(nuevoLote, { status: 201 });
  } catch (error) {
    console.error("Error al registrar lote:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
