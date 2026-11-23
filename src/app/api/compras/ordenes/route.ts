import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

const activeOrdenes = new Set<number>();

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const proveedorId = searchParams.get("proveedorId");
    const estado = searchParams.get("estado");

    const where: any = {};
    if (proveedorId) where.proveedorId = parseInt(proveedorId);
    if (estado) where.estado = estado;
    if (session.user.role !== "Administrador") {
      where.sucursalId = session.user.sucursalId;
    }

    const ordenes = await prisma.ordenCompra.findMany({
      where,
      include: {
        proveedor: { select: { id: true, nombre: true } },
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombreVendedor: true } },
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                nombreComercial: true,
                nombreGenerico: true,
                concentracion: true,
                presentacion: true,
                laboratorio: { select: { nombre: true } },
              },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const computed = ordenes.map(orden => ({
      ...orden,
      detalles: orden.detalles.map(d => ({
        ...d,
        producto: {
          ...d.producto,
          nombreProducto: getFullProductName(d.producto),
        },
      })),
    }));
    return NextResponse.json(computed);
  } catch (error) {
    console.error("Error al listar órdenes de compra:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const userId = parseInt(session.user.id);
  if (activeOrdenes.has(userId)) {
    return NextResponse.json({ error: "Ya tiene una orden en proceso" }, { status: 409 });
  }
  activeOrdenes.add(userId);

  try {
    const body = await request.json();
    const { proveedorId, sucursalId, detalles, observaciones } = body;

    if (!detalles || detalles.length === 0) {
      return NextResponse.json(
        { error: "Debe agregar al menos un producto" },
        { status: 400 }
      );
    }

    const sucursal = sucursalId || session.user.sucursalId;
    if (!sucursal) {
      return NextResponse.json(
        { error: "No se especificó sucursal" },
        { status: 400 }
      );
    }

    let total = 0;
    const detallesData = detalles.map((d: any) => {
      const subtotal = d.cantidad * d.precioUnitario;
      total += subtotal;
      return {
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        subtotal,
      };
    });

    const orden = await prisma.ordenCompra.create({
      data: {
        proveedorId: proveedorId ? parseInt(proveedorId) : null,
        sucursalId: parseInt(sucursal),
        usuarioId: parseInt(session.user.id),
        total,
        observaciones: observaciones || null,
        detalles: { create: detallesData },
      },
      include: {
        ...(proveedorId ? { proveedor: { select: { id: true, nombre: true } } } : {}),
        detalles: {
          include: {
            producto: {
              select: {
                id: true,
                nombreComercial: true,
                nombreGenerico: true,
                concentracion: true,
                presentacion: true,
                laboratorio: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    const computed = {
      ...orden,
      detalles: orden.detalles.map(d => ({
        ...d,
        producto: {
          ...d.producto,
          nombreProducto: getFullProductName(d.producto),
        },
      })),
    };
    return NextResponse.json(computed, { status: 201 });
  } catch (error) {
    console.error("Error al crear orden de compra:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  } finally {
    activeOrdenes.delete(userId);
  }
}
