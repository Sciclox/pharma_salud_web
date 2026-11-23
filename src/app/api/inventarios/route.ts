import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

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
            nombreComercial: true,
            nombreGenerico: true,
            concentracion: true,
            presentacion: true,
            sku: true,
            codigoBarras: true,
            cantidadPresentacion: true,
            cantidadPresentacionBlister: true,
            contenidoNetoValor: true,
            contenidoNetoUnidad: true,
            categorias: { select: { nombre: true } },
            formaFarmaceuticaRel: { select: { nombre: true } },
            laboratorio: { select: { nombre: true } },
            compuestos: {
              select: {
                concentracion: true,
                compuesto: { select: { nombre: true } },
              },
            },
          },
        },
      },
      orderBy: {
        producto: {
          nombreComercial: "asc",
        },
      },
    });

    const mappedInventario = inventario.map(item => ({
      ...item,
      producto: {
        ...item.producto,
        nombreProducto: getFullProductName(item.producto)
      }
    }));

    return NextResponse.json(mappedInventario);
  } catch (error) {
    console.error("Error al obtener inventario de sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/inventarios - Actualizar stock, precios y costos de un producto en una/todas las sucursales (Solo Admin)
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
      precioBlister,
      costo,
      stockMinimo,
    } = body;

    if (!productoId || !sucursalId) {
      return NextResponse.json(
        { error: "productoId y sucursalId son requeridos" },
        { status: 400 }
      );
    }

    const pId = parseInt(productoId);

    // ── MODO GLOBAL: aplicar cambios a TODAS las sucursales ──────────────────
    if (sucursalId === "todos") {
      // Obtener todas las sucursales existentes
      const todasSucursales = await prisma.sucursal.findMany({ select: { id: true } });

      const updateData = {
        precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : undefined,
        precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : undefined,
        precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : undefined,
        costo: costo !== undefined ? parseFloat(costo) : undefined,
        stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : undefined,
        // cantidadTotal se omite intencionalmente en modo global para no sobreescribir stock individual
      };

      // Ejecutar upsert para cada sucursal en una transacción
      const ops = todasSucursales.map((s) =>
        prisma.inventarioSucursal.upsert({
          where: { productoId_sucursalId: { productoId: pId, sucursalId: s.id } },
          update: updateData,
          create: {
            productoId: pId,
            sucursalId: s.id,
            cantidadTotal: 0,
            precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : 0,
            precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : 0,
            precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : 0,
            costo: costo !== undefined ? parseFloat(costo) : 0,
            stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : 0,
          },
        })
      );

      await prisma.$transaction(ops);
      return NextResponse.json({ ok: true, sucursalesActualizadas: todasSucursales.length });
    }

    // ── MODO LOCAL: aplicar cambios solo a la sucursal seleccionada ──────────
    const sId = parseInt(sucursalId);
    if (isNaN(sId)) {
      return NextResponse.json({ error: "sucursalId inválido" }, { status: 400 });
    }

    const inventarioActualizado = await prisma.inventarioSucursal.upsert({
      where: { productoId_sucursalId: { productoId: pId, sucursalId: sId } },
      update: {
        cantidadTotal: cantidadTotal !== undefined ? parseInt(cantidadTotal) : undefined,
        precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : undefined,
        precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : undefined,
        precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : undefined,
        costo: costo !== undefined ? parseFloat(costo) : undefined,
        stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : undefined,
      },
      create: {
        productoId: pId,
        sucursalId: sId,
        cantidadTotal: cantidadTotal !== undefined ? parseInt(cantidadTotal) : 0,
        precioCaja: precioCaja !== undefined ? parseFloat(precioCaja) : 0,
        precioUnidad: precioUnidad !== undefined ? parseFloat(precioUnidad) : 0,
        precioBlister: precioBlister !== undefined ? parseFloat(precioBlister) : 0,
        costo: costo !== undefined ? parseFloat(costo) : 0,
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
