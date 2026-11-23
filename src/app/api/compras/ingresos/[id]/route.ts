import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const ingresoId = parseInt(id);
    if (isNaN(ingresoId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const ingreso = await prisma.ingresoMercaderia.findUnique({
      where: { id: ingresoId },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombreVendedor: true } },
        ordenCompra: {
          select: {
            id: true,
            proveedor: { select: { nombre: true, ruc: true } },
          },
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
    });

    if (!ingreso) {
      return NextResponse.json(
        { error: "Ingreso no encontrado" },
        { status: 404 }
      );
    }

    const computed = {
      ...ingreso,
      detalles: ingreso.detalles.map(d => ({
        ...d,
        producto: {
          ...d.producto,
          nombreProducto: getFullProductName(d.producto),
        },
      })),
    };
    return NextResponse.json(computed);
  } catch (error) {
    console.error("Error al obtener ingreso:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
