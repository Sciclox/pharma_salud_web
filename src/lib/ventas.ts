import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

export async function completarVenta(ventaId: number) {
  return await prisma.$transaction(async (tx) => {
    const venta = await tx.registroVentas.findUnique({
      where: { id: ventaId },
      include: {
        detalles: {
          include: {
            producto: {
              include: {
                laboratorio: true,
              },
            },
          },
        },
      },
    });

    if (!venta) {
      throw new Error("Venta no encontrada");
    }

    if (venta.estado !== "pendiente") {
      throw new Error(`La venta ya está "${venta.estado}"`);
    }

    // Descontar stock por cada detalle
    for (const detalle of venta.detalles) {
      const prod = detalle.producto;
      let unidadesARestar = 0;

      if (detalle.tipoVenta === "Venta por caja") {
        const factor = prod.cantidadPresentacion || 1;
        unidadesARestar = detalle.cantidad * factor;
      } else if (detalle.tipoVenta === "Venta por blíster") {
        const factor = prod.cantidadPresentacionBlister || 1;
        unidadesARestar = detalle.cantidad * factor;
      } else {
        unidadesARestar = detalle.cantidad * 1;
      }

      const inventario = await tx.inventarioSucursal.findUnique({
        where: {
          productoId_sucursalId: {
            productoId: detalle.productoId,
            sucursalId: venta.sucursalId,
          },
        },
      });

      if (!inventario) {
        throw new Error(`El producto ${getFullProductName(prod)} no tiene inventario en esta sucursal`);
      }

      if (inventario.cantidadTotal < unidadesARestar) {
        throw new Error(`Stock insuficiente para ${getFullProductName(prod)}`);
      }

      await tx.inventarioSucursal.update({
        where: {
          productoId_sucursalId: {
            productoId: detalle.productoId,
            sucursalId: venta.sucursalId,
          },
        },
        data: {
          cantidadTotal: { decrement: unidadesARestar },
        },
      });

      let remanenteADescontar = unidadesARestar;

      const lotes = await tx.expiracionLote.findMany({
        where: {
          productoId: detalle.productoId,
          sucursalId: venta.sucursalId,
        },
        orderBy: { fechaVencimiento: "asc" },
      });

      for (const lote of lotes) {
        if (remanenteADescontar <= 0) break;

        if (lote.cantidad <= remanenteADescontar) {
          remanenteADescontar -= lote.cantidad;
          await tx.expiracionLote.delete({ where: { id: lote.id } });
        } else {
          await tx.expiracionLote.update({
            where: { id: lote.id },
            data: { cantidad: { decrement: remanenteADescontar } },
          });
          remanenteADescontar = 0;
        }
      }

      await tx.kardex.create({
        data: {
          sucursalId: venta.sucursalId,
          productoId: detalle.productoId,
          nombreProducto: getFullProductName(prod),
          tipoMovimiento: detalle.tipoVenta,
          cantidad: -unidadesARestar,
          idDetalleVenta: detalle.id,
        },
      });
    }

    await tx.registroVentas.update({
      where: { id: ventaId },
      data: { estado: "completado" },
    });

    return { ventaId };
  });
}
