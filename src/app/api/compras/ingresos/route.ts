import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

const activeIngresos = new Set<number>();

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sucursalId = searchParams.get("sucursalId");

    const where: any = {};
    if (sucursalId) where.sucursalId = parseInt(sucursalId);

    const ingresos = await prisma.ingresoMercaderia.findMany({
      where,
      include: {
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombreVendedor: true } },
        ordenCompra: {
          select: { id: true, proveedor: { select: { nombre: true } } },
        },
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

    const ingresosMapeados = ingresos.map(i => ({
      ...i,
      detalles: i.detalles.map(d => ({
        ...d,
        producto: {
          ...d.producto,
          nombreProducto: getFullProductName(d.producto as any),
        },
      })),
    }));

    return NextResponse.json(ingresosMapeados);
  } catch (error) {
    console.error("Error al listar ingresos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "Administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const userId = parseInt(session.user.id);
  if (activeIngresos.has(userId)) {
    return NextResponse.json({ error: "Ya tiene un ingreso en proceso" }, { status: 409 });
  }
  activeIngresos.add(userId);

  try {
    const body = await request.json();
    const { ordenCompraId, sucursalId, detalles, observaciones } = body;

    if (!detalles || detalles.length === 0) {
      return NextResponse.json(
        { error: "Debe agregar al menos un producto" },
        { status: 400 }
      );
    }

    const sucursal = parseInt(sucursalId || session.user.sucursalId);
    if (!sucursal) {
      return NextResponse.json(
        { error: "No se especificó sucursal" },
        { status: 400 }
      );
    }

    const usuarioId = parseInt(session.user.id);

    const result = await prisma.$transaction(async (tx) => {
      const ingreso = await tx.ingresoMercaderia.create({
        data: {
          ordenCompraId: ordenCompraId ? parseInt(ordenCompraId) : null,
          sucursalId: sucursal,
          usuarioId,
          tipoIngreso: ordenCompraId ? "orden_compra" : "directo",
          observaciones: observaciones || null,
          detalles: {
            create: detalles.map((d: any) => ({
              productoId: d.productoId,
              cantidad: d.cantidad,
              precioUnitario: d.precioUnitario,
              fechaVencimiento: d.fechaVencimiento
                ? new Date(d.fechaVencimiento)
                : null,
              lote: d.lote || null,
            })),
          },
        },
        include: {
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

      for (const d of detalles) {
        const producto = await tx.producto.findUnique({
          where: { id: d.productoId },
          select: {
            nombreComercial: true,
            nombreGenerico: true,
            concentracion: true,
            presentacion: true,
            cantidadPresentacion: true,
            laboratorio: { select: { nombre: true } },
          },
        });

        const nuevoCosto = d.precioUnitario;

        await tx.inventarioSucursal.upsert({
          where: {
            productoId_sucursalId: {
              productoId: d.productoId,
              sucursalId: sucursal,
            },
          },
          update: {
            cantidadTotal: { increment: d.cantidad },
            costo: nuevoCosto,
          },
          create: {
            productoId: d.productoId,
            sucursalId: sucursal,
            cantidadTotal: d.cantidad,
            precioCaja: 0,
            precioUnidad: 0,
            costo: nuevoCosto,
            stockMinimo: 0,
          },
        });

        await tx.kardex.create({
          data: {
            sucursalId: sucursal,
            productoId: d.productoId,
            nombreProducto: producto ? getFullProductName(producto) : "Producto",
            tipoMovimiento: "INGRESO",
            cantidad: d.cantidad,
          },
        });

        if (d.fechaVencimiento) {
          const existingLote = await tx.expiracionLote.findFirst({
            where: {
              productoId: d.productoId,
              sucursalId: sucursal,
              fechaVencimiento: new Date(d.fechaVencimiento),
            },
          });

          if (existingLote) {
            await tx.expiracionLote.update({
              where: { id: existingLote.id },
              data: { cantidad: { increment: d.cantidad } },
            });
          } else {
            await tx.expiracionLote.create({
              data: {
                sucursalId: sucursal,
                productoId: d.productoId,
                fechaVencimiento: new Date(d.fechaVencimiento),
                cantidad: d.cantidad,
              },
            });
          }
        }
      }

      if (ordenCompraId) {
        await tx.ordenCompra.update({
          where: { id: parseInt(ordenCompraId) },
          data: { estado: "completada" },
        });
      }

      return ingreso;
    });

    const resultMapeado = {
      ...result,
      detalles: result.detalles.map(d => ({
        ...d,
        producto: {
          ...d.producto,
          nombreProducto: getFullProductName(d.producto as any),
        },
      })),
    };

    return NextResponse.json(resultMapeado, { status: 201 });
  } catch (error) {
    console.error("Error al registrar ingreso:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  } finally {
    activeIngresos.delete(userId);
  }
}
