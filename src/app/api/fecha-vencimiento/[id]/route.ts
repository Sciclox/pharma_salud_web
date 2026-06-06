import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// DELETE /api/fecha-vencimiento/[id] - Eliminar un lote y descontarlo de stock físico de la sucursal
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const loteId = parseInt(id);

    if (isNaN(loteId)) {
      return NextResponse.json(
        { error: "ID de lote inválido" },
        { status: 400 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener el lote antes de borrarlo para saber el producto y la cantidad
      const lote = await tx.expiracionLote.findUnique({
        where: { id: loteId },
      });

      if (!lote) {
        throw new Error("Lote no encontrado");
      }

      const sucursalId = lote.sucursalId;
      const productoId = lote.productoId;
      const cantidadARestar = lote.cantidad;

      // 2. Eliminar el lote
      await tx.expiracionLote.delete({
        where: { id: loteId },
      });

      // 3. Descontar stock del inventario físico en la sucursal
      const inventario = await tx.inventarioSucursal.update({
        where: {
          productoId_sucursalId: {
            productoId,
            sucursalId,
          },
        },
        data: {
          cantidadTotal: {
            decrement: cantidadARestar,
          },
        },
      });

      // Evitar que quede con stock negativo (por si hubo descuadres previos)
      if (inventario.cantidadTotal < 0) {
        await tx.inventarioSucursal.update({
          where: {
            productoId_sucursalId: {
              productoId,
              sucursalId,
            },
          },
          data: {
            cantidadTotal: 0,
          },
        });
      }

      return {
        message: "Lote eliminado y stock actualizado correctamente",
      };
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("Error al eliminar lote de vencimiento:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el lote" },
      { status: 400 }
    );
  }
}
