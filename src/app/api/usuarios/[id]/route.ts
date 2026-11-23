import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/usuarios/[id] - Obtener detalles de un usuario (Solo Admin)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const usuarioId = parseInt(id);

    if (isNaN(usuarioId)) {
      return NextResponse.json(
        { error: "ID de usuario inválido" },
        { status: 400 }
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        sucursal: {
          select: { nombre: true },
        },
      },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Excluir contraseña
    const { clave, ...usuarioSeguro } = usuario;

    return NextResponse.json(usuarioSeguro);
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/usuarios/[id] - Actualizar usuario (Solo Admin)
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
    const usuarioId = parseInt(id);

    if (isNaN(usuarioId)) {
      return NextResponse.json(
        { error: "ID de usuario inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nombreUsuario, nombreVendedor, clave, rol, sucursalId, genero, estado } = body;

    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuarioExistente) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Si cambia el nombre de usuario, verificar unicidad
    if (nombreUsuario && nombreUsuario !== usuarioExistente.nombreUsuario) {
      const choque = await prisma.usuario.findUnique({
        where: { nombreUsuario },
      });
      if (choque) {
        return NextResponse.json(
          { error: "El nombre de usuario ya está en uso" },
          { status: 400 }
        );
      }
    }

    // Preparar objeto de actualización
    const updateData: any = {
      nombreUsuario: nombreUsuario ?? undefined,
      nombreVendedor: nombreVendedor ?? undefined,
      rol: rol ?? undefined,
      sucursalId: sucursalId !== undefined ? (sucursalId ? parseInt(sucursalId) : null) : undefined,
      genero: genero ?? undefined,
      estado: estado ?? undefined,
    };

    // Si se envía una nueva contraseña, encriptarla con bcrypt
    if (clave && clave.trim() !== "") {
      updateData.clave = await bcrypt.hash(clave, 10);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: usuarioId },
      data: updateData,
    });

    // Excluir clave
    const { clave: _, ...usuarioActualizadoSeguro } = usuarioActualizado;

    return NextResponse.json(usuarioActualizadoSeguro);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/usuarios/[id] - Eliminar usuario (Solo Admin)
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
    const usuarioId = parseInt(id);

    if (isNaN(usuarioId)) {
      return NextResponse.json(
        { error: "ID de usuario inválido" },
        { status: 400 }
      );
    }

    // Impedir que un admin se borre a sí mismo
    if (usuarioId.toString() === session.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario" },
        { status: 400 }
      );
    }

    // Verificar datos relacionados antes de eliminar
    const relations = [
      { table: "ventas", count: await prisma.registroVentas.count({ where: { usuarioId } }) },
      { table: "órdenes de compra", count: await prisma.ordenCompra.count({ where: { usuarioId } }) },
      { table: "ingresos de mercadería", count: await prisma.ingresoMercaderia.count({ where: { usuarioId } }) },
      { table: "sobrantes de caja", count: await prisma.sobranteCaja.count({ where: { usuarioId } }) },
      { table: "transferencias", count: await prisma.transferencia.count({ where: { usuarioId } }) },
      { table: "carrito de ventas", count: await prisma.carritoVentas.count({ where: { idUsuario: usuarioId } }) },
    ];

    const conDatos = relations.filter(r => r.count > 0);

    if (conDatos.length > 0) {
      const detalle = conDatos.map(r => `${r.count} ${r.table}`).join(", ");
      return NextResponse.json({
        error: `No se puede eliminar el usuario porque tiene datos relacionados: ${detalle}. Desactívelo o elimine esos registros primero.`,
        relaciones: conDatos,
      }, { status: 409 });
    }

    await prisma.usuario.delete({
      where: { id: usuarioId },
    });

    return NextResponse.json({
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
