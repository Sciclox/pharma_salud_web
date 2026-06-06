import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const idUsuario = parseInt(session.user.id);
    const sucursalId = session.user.sucursalId;

    const body = await request.json();
    const { pagoCon, vuelto } = body;

    if (pagoCon === undefined || vuelto === undefined) {
      return NextResponse.json(
        { error: "pagoCon y vuelto son campos requeridos" },
        { status: 400 }
      );
    }

    const pagoConNum = parseFloat(pagoCon);
    const vueltoNum = parseFloat(vuelto);

    // Ejecutar todo el proceso dentro de una transacción atómica de base de datos
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener los items del carrito actual del vendedor
      const carritoItems = await tx.carritoVentas.findMany({
        where: { idUsuario, sucursalId },
        include: {
          producto: true,
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
          throw new Error(`El producto ${prod.nombreProducto} no tiene inventario asignado en esta sucursal`);
        }

        if (inventario.cantidadTotal < unidadesARestar) {
          throw new Error(`Stock insuficiente para ${prod.nombreProducto}. Disponible: ${inventario.cantidadTotal} unidades, Solicitado: ${unidadesARestar} unidades`);
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
            fechaVencimiento: "asc", // FIFO: el que vence primero se descuenta antes
          },
        });

        for (const lote of lotes) {
          if (remanenteADescontar <= 0) break;

          if (lote.cantidad <= remanenteADescontar) {
            // Se agota este lote completo, se elimina
            remanenteADescontar -= lote.cantidad;
            await tx.expiracionLote.delete({
              where: { id: lote.id },
            });
          } else {
            // Descontar parcialmente de este lote
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

        // Nota: Si el remanente es mayor que 0 significa que se vendieron unidades que
        // no tenían lote cargado. En farmacia esto puede pasar por descuadres,
        // no lanzamos error pero asumimos que el stock físico se restó correctamente de inventario.

        // Crear el detalle de la venta (detalles_venta)
        const detalle = await tx.detalleVenta.create({
          data: {
            registroVentaId: ventaHeader.id,
            productoId: item.productoId,
            nombreProducto: prod.nombreProducto,
            usuarioId: idUsuario,
            tipoVenta: item.tipoVenta,
            cantidad: item.cantidad,
            precioVenta: item.precioVenta,
            devolucion: "No",
          },
        });

        // Crear registro en Kardex (Auditoría de inventario)
        await tx.kardex.create({
          data: {
            sucursalId,
            productoId: item.productoId,
            nombreProducto: prod.nombreProducto,
            tipoMovimiento: item.tipoVenta, // "Venta por unidad/caja/blíster"
            cantidad: -unidadesARestar, // Se guarda en negativo porque es una salida
            idDetalleVenta: detalle.id,
          },
        });
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
      };
    });

    return NextResponse.json({
      success: true,
      message: "Venta procesada correctamente",
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
