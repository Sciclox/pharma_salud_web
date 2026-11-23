import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";
import { calcularStockMinimoIndividual } from "@/lib/stock";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const idUsuario = parseInt(session.user.id);
    const sucursalId = session.user.sucursalId;

    const body = await request.json();
    const { pagoCon, vuelto, metodoPago, referenciaPago, pendiente } = body;

    if (pagoCon === undefined || vuelto === undefined) {
      return NextResponse.json(
        { error: "pagoCon y vuelto son campos requeridos" },
        { status: 400 }
      );
    }

    const pagoConNum = parseFloat(pagoCon);
    const vueltoNum = parseFloat(vuelto);
    const metodoNombre = metodoPago || "efectivo";
    const esPendiente = pendiente === true;

    // Buscar el MetodoPago por nombre para usar FK
    const metodoPagoRecord = await prisma.metodoPago.findUnique({ where: { nombre: metodoNombre } });

    // Ejecutar todo el proceso dentro de una transacción atómica de base de datos
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener los items del carrito actual del vendedor
      const carritoItems = await tx.carritoVentas.findMany({
        where: { idUsuario, sucursalId },
        include: {
          producto: {
            include: {
              laboratorio: true,
            },
          },
        },
      });

      if (carritoItems.length === 0) {
        throw new Error("El carrito está vacío");
      }

      // 2. Calcular el total de la venta
      let totalVenta = 0;
      for (const item of carritoItems) {
        totalVenta += item.cantidad * item.precioVenta;
      }

      // 3. Crear el encabezado de la venta (registro_de_ventas)
      const ventaHeader = await tx.registroVentas.create({
        data: {
          sucursalId,
          usuarioId: idUsuario,
          total: totalVenta,
          pagoCon: pagoConNum,
          vuelto: vueltoNum,
          metodoPagoId: metodoPagoRecord?.id || null,
          referenciaPago: metodoNombre !== "efectivo" ? (referenciaPago || null) : null,
          estado: esPendiente ? "pendiente" : "completado",
        },
      });

      // 4. Procesar cada item del carrito
      for (const item of carritoItems) {
        const prod = item.producto;
        let unidadesARestar = 0;

        // Normalización de unidades según tipo de venta
        if (item.tipoVenta === "Venta por caja") {
          const factor = prod.cantidadPresentacion || 1;
          unidadesARestar = item.cantidad * factor;
        } else if (item.tipoVenta === "Venta por blíster") {
          const factor = prod.cantidadPresentacionBlister || 1;
          unidadesARestar = item.cantidad * factor;
        } else {
          // Venta por unidad
          unidadesARestar = item.cantidad * 1;
        }

        if (esPendiente) {
          // Crear únicamente el detalle, sin descontar stock
          await tx.detalleVenta.create({
            data: {
              registroVentaId: ventaHeader.id,
              productoId: item.productoId,
              nombreProducto: getFullProductName(prod),
              tipoVenta: item.tipoVenta,
              cantidad: item.cantidad,
              precioVenta: item.precioVenta,
              devolucion: "No",
            },
          });
        } else {
          // Consultar stock en la sucursal actual
          const inventario = await tx.inventarioSucursal.findUnique({
            where: {
              productoId_sucursalId: {
                productoId: item.productoId,
                sucursalId,
              },
            },
          });

          if (!inventario) {
            throw new Error(`El producto ${getFullProductName(prod)} no tiene inventario asignado en esta sucursal`);
          }

          if (inventario.cantidadTotal < unidadesARestar) {
            throw new Error(`Stock insuficiente para ${getFullProductName(prod)}. Disponible: ${inventario.cantidadTotal} unidades, Solicitado: ${unidadesARestar} unidades`);
          }

          // Descontar del stock global en la sucursal
          await tx.inventarioSucursal.update({
            where: {
              productoId_sucursalId: {
                productoId: item.productoId,
                sucursalId,
              },
            },
            data: {
              cantidadTotal: {
                decrement: unidadesARestar,
              },
            },
          });

          // FIFO: Descontar de las fechas de vencimiento (lotes) de la sucursal
          let remanenteADescontar = unidadesARestar;
          
          const lotes = await tx.expiracionLote.findMany({
            where: {
              productoId: item.productoId,
              sucursalId,
            },
            orderBy: {
              fechaVencimiento: "asc",
            },
          });

          for (const lote of lotes) {
            if (remanenteADescontar <= 0) break;

            if (lote.cantidad <= remanenteADescontar) {
              remanenteADescontar -= lote.cantidad;
              await tx.expiracionLote.delete({
                where: { id: lote.id },
              });
            } else {
              await tx.expiracionLote.update({
                where: { id: lote.id },
                data: {
                  cantidad: {
                    decrement: remanenteADescontar,
                  },
                },
              });
              remanenteADescontar = 0;
            }
          }

          // Crear el detalle de la venta
          const detalle = await tx.detalleVenta.create({
            data: {
              registroVentaId: ventaHeader.id,
              productoId: item.productoId,
              nombreProducto: getFullProductName(prod),
              tipoVenta: item.tipoVenta,
              cantidad: item.cantidad,
              precioVenta: item.precioVenta,
              devolucion: "No",
            },
          });

          // Crear registro en Kardex
          await tx.kardex.create({
            data: {
              sucursalId,
              productoId: item.productoId,
              nombreProducto: getFullProductName(prod),
              tipoMovimiento: item.tipoVenta,
              cantidad: -unidadesARestar,
              idDetalleVenta: detalle.id,
            },
          });
        }
      }

      // 5. Limpiar el carrito del vendedor
      await tx.carritoVentas.deleteMany({
        where: { idUsuario, sucursalId },
      });

      return {
        ventaId: ventaHeader.id,
        total: totalVenta,
        pagoCon: pagoConNum,
        vuelto: vueltoNum,
        metodoPago: metodoNombre,
        referenciaPago: metodoNombre !== "efectivo" ? (referenciaPago || null) : null,
        estado: esPendiente ? "pendiente" : "completado",
        productosIds: carritoItems.map(item => item.productoId),
      };
    });

    // Recalcular stock mínimo automáticamente para los productos vendidos
    try {
      const promesas = resultado.productosIds.map((pId: number) =>
        calcularStockMinimoIndividual(pId, sucursalId)
      );
      await Promise.all(promesas);
    } catch (recalcError) {
      console.error("Error al recalcular automáticamente stock mínimo post-venta:", recalcError);
    }

    return NextResponse.json({
      success: true,
      message: esPendiente ? "Venta registrada, pendiente de pago" : "Venta procesada correctamente",
      ...resultado,
    });
  } catch (error: any) {
    console.error("Error al procesar cobro de venta:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la venta" },
      { status: 400 }
    );
  }
}
