import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/sucursales/[id] - Obtener detalles de una sucursal
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const sucursalId = parseInt(id);

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const sucursal = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
    });

    if (!sucursal) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(sucursal);
  } catch (error) {
    console.error("Error al obtener sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/sucursales/[id] - Actualizar sucursal (Solo Admin)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const sucursalId = parseInt(id);

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombre, direccion, afiliada, estado } = body;

    const sucursalExistente = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
    });

    if (!sucursalExistente) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    // Si intenta cambiar el nombre, verificar que no choque con otra sucursal
    if (nombre && nombre !== sucursalExistente.nombre) {
      const choque = await prisma.sucursal.findUnique({
        where: { nombre },
      });
      if (choque) {
        return NextResponse.json(
          { error: "Ya existe otra sucursal con ese nombre" },
          { status: 400 }
        );
      }
    }

    const sucursalActualizada = await prisma.sucursal.update({
      where: { id: sucursalId },
      data: {
        nombre: nombre ?? undefined,
        direccion: direccion ?? undefined,
        afiliada: afiliada ?? undefined,
        estado: estado ?? undefined,
      },
    });

    return NextResponse.json(sucursalActualizada);
  } catch (error) {
    console.error("Error al actualizar sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/sucursales/[id] - Eliminar solo si no hay datos relacionados (Solo Admin)
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
    const sucursalId = parseInt(id);

    if (isNaN(sucursalId)) {
      return NextResponse.json(
        { error: "ID de sucursal inválido" },
        { status: 400 }
      );
    }

    const sucursal = await prisma.sucursal.findUnique({
      where: { id: sucursalId },
    });

    if (!sucursal) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      );
    }

    // Verificar datos relacionados antes de eliminar
    const relations = [
      { table: "usuarios", count: await prisma.usuario.count({ where: { sucursalId } }) },
      { table: "ventas", count: await prisma.registroVentas.count({ where: { sucursalId } }) },
      { table: "inventarios", count: await prisma.inventarioSucursal.count({ where: { sucursalId } }) },
      { table: "kardex", count: await prisma.kardex.count({ where: { sucursalId } }) },
      { table: "órdenes de compra", count: await prisma.ordenCompra.count({ where: { sucursalId } }) },
      { table: "ingresos", count: await prisma.ingresoMercaderia.count({ where: { sucursalId } }) },
      { table: "lotes de vencimiento", count: await prisma.expiracionLote.count({ where: { sucursalId } }) },
      { table: "sobrantes de caja", count: await prisma.sobranteCaja.count({ where: { sucursalId } }) },
      { table: "carrito de ventas", count: await prisma.carritoVentas.count({ where: { sucursalId } }) },
      { table: "transferencias enviadas", count: await prisma.transferencia.count({ where: { sucursalOrigenId: sucursalId } }) },
      { table: "transferencias recibidas", count: await prisma.transferencia.count({ where: { sucursalDestinoId: sucursalId } }) },
    ];

    const conDatos = relations.filter(r => r.count > 0);

    if (conDatos.length > 0) {
      const detalle = conDatos.map(r => `${r.count} ${r.table}`).join(", ");
      return NextResponse.json({
        error: `No se puede eliminar la sucursal porque tiene datos relacionados: ${detalle}. Desactívela o elimine esos registros primero.`,
        relaciones: conDatos,
      }, { status: 409 });
    }

    await prisma.sucursal.delete({
      where: { id: sucursalId },
    });

    return NextResponse.json({
      message: "Sucursal eliminada correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar sucursal:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
