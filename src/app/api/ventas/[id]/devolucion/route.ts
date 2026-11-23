import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";
import { calcularStockMinimoIndividual } from "@/lib/stock";

// POST /api/ventas/[id]/devolucion - Marcar un detalle de venta como devuelto y reingresar stock
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    // En el POS de Flutter, los Vendedores pueden procesar devoluciones en el día.
    // Daremos acceso tanto a Vendedores como Administradores.
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const detalleId = parseInt(id);

    if (isNaN(detalleId)) {
      return NextResponse.json(
        { error: "ID de detalle de venta inválido" },
        { status: 400 }
      );
    }

    // Ejecutar todo el reingreso de stock en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener el detalle de la venta
      const detalle = await tx.detalleVenta.findUnique({
        where: { id: detalleId },
        include: {
          registroVenta: true,
          producto: {
            include: {
              laboratorio: true,
            },
          },
        },
      });

      if (!detalle) {
        throw new Error("Detalle de venta no encontrado");
      }

      if (detalle.devolucion === "Si") {
        throw new Error("Este producto ya fue marcado como devuelto");
      }

      // Validar que si es vendedor, solo devuelva cosas de su propia sucursal
      if (session.user.role === "Vendedor" && detalle.registroVenta.sucursalId !== session.user.sucursalId) {
        throw new Error("No tienes autorización para realizar devoluciones en esta sucursal");
      }

      const sucursalId = detalle.registroVenta.sucursalId;
      const prod = detalle.producto;
      let unidadesAReingresar = 0;

      // Calcular unidades físicas a devolver basándose en el tipo de venta
      if (detalle.tipoVenta === "Venta por caja") {
        const factor = prod.cantidadPresentacion || 1;
        unidadesAReingresar = detalle.cantidad * factor;
      } else if (detalle.tipoVenta === "Venta por blíster") {
        const factor = prod.cantidadPresentacionBlister || 1;
        unidadesAReingresar = detalle.cantidad * factor;
      } else {
        // Venta por unidad
        unidadesAReingresar = detalle.cantidad * 1;
      }

      // 2. Marcar el detalle como devuelto
      const detalleActualizado = await tx.detalleVenta.update({
        where: { id: detalleId },
        data: { devolucion: "Si" },
      });

      // 3. Reingresar el stock físico en la sucursal
      await tx.inventarioSucursal.update({
        where: {
          productoId_sucursalId: {
            productoId: detalle.productoId,
            sucursalId,
          },
        },
        data: {
          cantidadTotal: {
            increment: unidadesAReingresar,
          },
        },
      });

      // 4. Crear registro en Kardex (Auditoría - Entrada positiva)
      await tx.kardex.create({
        data: {
          sucursalId,
          productoId: detalle.productoId,
          nombreProducto: getFullProductName(prod),
          tipoMovimiento: "Devuelto",
          cantidad: unidadesAReingresar, // Positivo por reingreso
          idDetalleVenta: detalle.id,
        },
      });

      // 5. Reingresar al lote de vencimiento más próximo a vencer (para que esté disponible primero)
      const primerLote = await tx.expiracionLote.findFirst({
        where: {
          productoId: detalle.productoId,
          sucursalId,
        },
        orderBy: {
          fechaVencimiento: "asc",
        },
      });

      if (primerLote) {
        // Si ya hay lotes para ese producto en esa sucursal, sumarlo al primero
        await tx.expiracionLote.update({
          where: { id: primerLote.id },
          data: {
            cantidad: {
              increment: unidadesAReingresar,
            },
          },
        });
      } else {
        // Si por alguna razón no hay lotes de ese producto en esa sucursal,
        // creamos uno nuevo con vencimiento dentro de 1 año como fallback
        const unAnioDespues = new Date();
        unAnioDespues.setFullYear(unAnioDespues.getFullYear() + 1);

        await tx.expiracionLote.create({
          data: {
            sucursalId,
            productoId: detalle.productoId,
            fechaVencimiento: unAnioDespues,
            cantidad: unidadesAReingresar,
          },
        });
      }

      return {
        detalle: detalleActualizado,
        productoId: detalle.productoId,
        sucursalId,
      };
    });

    // Recalcular stock mínimo automáticamente para el producto devuelto
    try {
      await calcularStockMinimoIndividual(resultado.productoId, resultado.sucursalId);
    } catch (recalcError) {
      console.error("Error al recalcular automáticamente stock mínimo post-devolución:", recalcError);
    }

    return NextResponse.json({
      success: true,
      message: "Devolución y reingreso de stock procesados correctamente",
      detalle: resultado.detalle,
    });
  } catch (error: any) {
    console.error("Error al procesar devolución:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la devolución" },
      { status: 400 }
    );
  }
}
