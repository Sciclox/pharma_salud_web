import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/inventarios - Obtener inventario de una sucursal (?sucursalId=X)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let sucursalIdParam = searchParams.get("sucursalId");
    let sucursalId: number | null = null;

    // Si el usuario es un Vendedor, forzar a que vea SOLO su sucursal amarrada
    if (session.user.role === "Vendedor") {
      if (!session.user.sucursalId) {
        return NextResponse.json(
          { error: "Vendedor no asignado a ninguna sucursal" },
          { status: 400 }
        );
      }
      sucursalId = session.user.sucursalId;
    } else {
      // Si es Administrador, puede especificar qué sucursal ver
      if (sucursalIdParam) {
        sucursalId = parseInt(sucursalIdParam);
      } else {
        return NextResponse.json(
          { error: "El parámetro sucursalId es requerido para administradores" },
          { status: 400 }
        );
      }
    }

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const inventario = await prisma.inventarioSucursal.findMany({
      where: { sucursalId },
      include: {
        producto: {
          select: {
            nombreProducto: true,
            tipoProducto: true,
            cantidadPresentacion: true,
            cantidadPresentacionBlister: true,
          },
        },
      },
      orderBy: {
        producto: {
          nombreProducto: "asc",
        },
      },
    });

    return NextResponse.json(inventario);
  } catch (error) {
    console.error("Error al obtener inventario de sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/inventarios - Actualizar stock, precios y costos de un producto en una sucursal (Solo Admin)
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      productoId,
      sucursalId,
      cantidadTotal,
      precioCaja,
      precioUnidad,
      costoCaja,
      costoUnidad,
      stockMinimo,
    } = body;

    if (!productoId || !sucursalId) {
      return NextResponse.json(
        { error: "productoId y sucursalId son requeridos" },
        { status: 400 }
      );
    }

    // Realizar un upsert (crear o actualizar) de la fila de inventario
    const inventarioActualizado = await prisma.inventarioSucursal.upsert({
      where: {
        productoId_sucursalId: {
          productoId: parseInt(productoId),
          sucursalId: parseInt(sucursalId),
        },
      },
      update: {
        cantidadTotal: cantidadTotal !== undefined ? parseInt(cantidadTotal) : undefined,
        precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : undefined,
        precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : undefined,
        costoCaja: costoCaja !== undefined ? parseFloat(costoCaja) : undefined,
        costoUnidad: costoUnidad !== undefined ? parseFloat(costoUnidad) : undefined,
        stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : undefined,
      },
      create: {
        productoId: parseInt(productoId),
        sucursalId: parseInt(sucursalId),
        cantidadTotal: cantidadTotal !== undefined ? parseInt(cantidadTotal) : 0,
        precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : 0,
        precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : 0,
        costoCaja: costoCaja !== undefined ? parseFloat(costoCaja) : 0,
        costoUnidad: costoUnidad !== undefined ? parseFloat(costoUnidad) : 0,
        stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : 0,
      },
    });

    return NextResponse.json(inventarioActualizado);
  } catch (error) {
    console.error("Error al actualizar inventario de sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
