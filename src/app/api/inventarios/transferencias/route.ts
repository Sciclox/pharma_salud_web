import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

const activeTransfers = new Set<number>();

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const originId = searchParams.get("sucursalOrigenId");
    const destId = searchParams.get("sucursalDestinoId");

    const where: any = {};
    if (originId) where.sucursalOrigenId = parseInt(originId);
    if (destId) where.sucursalDestinoId = parseInt(destId);

    const transferencias = await prisma.transferencia.findMany({
      where,
      include: {
        sucursalOrigen: { select: { id: true, nombre: true } },
        sucursalDestino: { select: { id: true, nombre: true } },
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

    return NextResponse.json(transferencias);
  } catch (error) {
    console.error("Error al listar transferencias:", error);
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
  if (activeTransfers.has(userId)) {
    return NextResponse.json({ error: "Ya tiene una transferencia en proceso" }, { status: 409 });
  }
  activeTransfers.add(userId);

  try {
    const body = await request.json();
    const { sucursalOrigenId, sucursalDestinoId, detalles, observaciones } = body;

    if (!sucursalOrigenId || !sucursalDestinoId) {
      return NextResponse.json(
        { error: "Debe especificar sucursal de origen y destino" },
        { status: 400 }
      );
    }

    const origenId = parseInt(sucursalOrigenId);
    const destinoId = parseInt(sucursalDestinoId);

    if (origenId === destinoId) {
      return NextResponse.json(
        { error: "La sucursal de origen y destino no pueden ser la misma" },
        { status: 400 }
      );
    }

    if (!detalles || detalles.length === 0) {
      return NextResponse.json(
        { error: "Debe agregar al menos un producto para transferir" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar existencias en origen para cada producto
      for (const d of detalles) {
        const stockOrigen = await tx.inventarioSucursal.findUnique({
          where: {
            productoId_sucursalId: {
              productoId: d.productoId,
              sucursalId: origenId,
            },
          },
        });

        if (!stockOrigen || stockOrigen.cantidadTotal < d.cantidad) {
          const prod = await tx.producto.findUnique({
            where: { id: d.productoId },
            select: { nombreComercial: true, nombreGenerico: true },
          });
          const name = prod?.nombreComercial || prod?.nombreGenerico || "Producto";
          throw new Error(`Stock insuficiente para "${name}" en la sucursal de origen. Disponible: ${stockOrigen?.cantidadTotal || 0}`);
        }
      }

      // 2. Crear el registro de Transferencia
      const transferencia = await tx.transferencia.create({
        data: {
          sucursalOrigenId: origenId,
          sucursalDestinoId: destinoId,
          usuarioId: userId,
          observaciones: observaciones || null,
          detalles: {
            create: detalles.map((d: any) => ({
              productoId: d.productoId,
              cantidad: d.cantidad,
              fechaVencimiento: d.fechaVencimiento ? new Date(d.fechaVencimiento) : null,
              lote: d.lote || null,
            })),
          },
        },
      });

      // 3. Procesar inventarios, kardex y lotes
      for (const d of detalles) {
        // Obtener datos del producto para Kardex y valores por defecto de precios
        const prodData = await tx.producto.findUnique({
          where: { id: d.productoId },
          select: {
            nombreComercial: true,
            nombreGenerico: true,
            concentracion: true,
            presentacion: true,
            laboratorio: { select: { nombre: true } },
          },
        });
        const nombreProd = prodData ? getFullProductName(prodData) : "Producto";

        // Obtener precios/costos de la sucursal origen
        const invOrigen = await tx.inventarioSucursal.findUnique({
          where: {
            productoId_sucursalId: {
              productoId: d.productoId,
              sucursalId: origenId,
            },
          },
        });

        const costo = invOrigen?.costo || 0;
        const precioUnidad = invOrigen?.precioUnidad || 0;
        const precioCaja = invOrigen?.precioCaja || 0;

        // Descontar en origen
        await tx.inventarioSucursal.update({
          where: {
            productoId_sucursalId: {
              productoId: d.productoId,
              sucursalId: origenId,
            },
          },
          data: {
            cantidadTotal: { decrement: d.cantidad },
          },
        });

        // Incrementar en destino
        await tx.inventarioSucursal.upsert({
          where: {
            productoId_sucursalId: {
              productoId: d.productoId,
              sucursalId: destinoId,
            },
          },
          update: {
            cantidadTotal: { increment: d.cantidad },
            // Si el destino no tenía costos establecidos, copiamos los del origen
            costo: { set: costo },
          },
          create: {
            productoId: d.productoId,
            sucursalId: destinoId,
            cantidadTotal: d.cantidad,
            precioCaja,
            precioUnidad,
            costo,
            stockMinimo: 0,
          },
        });

        // Registrar movimientos en Kardex
        // Salida (origen)
        await tx.kardex.create({
          data: {
            sucursalId: origenId,
            productoId: d.productoId,
            nombreProducto: nombreProd,
            tipoMovimiento: "SALIDA TRANSFERENCIA",
            cantidad: -d.cantidad,
          },
        });

        // Entrada (destino)
        await tx.kardex.create({
          data: {
            sucursalId: destinoId,
            productoId: d.productoId,
            nombreProducto: nombreProd,
            tipoMovimiento: "INGRESO TRANSFERENCIA",
            cantidad: d.cantidad,
          },
        });

        // 4. Traspasar Expiración Lote
        if (d.fechaVencimiento) {
          const fechaVec = new Date(d.fechaVencimiento);

          // Buscar lote en origen
          const loteOrigen = await tx.expiracionLote.findFirst({
            where: {
              productoId: d.productoId,
              sucursalId: origenId,
              fechaVencimiento: fechaVec,
            },
          });

          if (loteOrigen) {
            // Descontar de lote en origen (sin bajar de 0)
            const nuevaCantLote = Math.max(0, loteOrigen.cantidad - d.cantidad);
            await tx.expiracionLote.update({
              where: { id: loteOrigen.id },
              data: { cantidad: nuevaCantLote },
            });
          }

          // Incrementar en destino
          const loteDestino = await tx.expiracionLote.findFirst({
            where: {
              productoId: d.productoId,
              sucursalId: destinoId,
              fechaVencimiento: fechaVec,
            },
          });

          if (loteDestino) {
            await tx.expiracionLote.update({
              where: { id: loteDestino.id },
              data: { cantidad: { increment: d.cantidad } },
            });
          } else {
            await tx.expiracionLote.create({
              data: {
                productoId: d.productoId,
                sucursalId: destinoId,
                fechaVencimiento: fechaVec,
                cantidad: d.cantidad,
              },
            });
          }
        }
      }

      return transferencia;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error al registrar transferencia:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  } finally {
    activeTransfers.delete(userId);
  }
}
