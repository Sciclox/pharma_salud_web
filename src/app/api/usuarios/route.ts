import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/usuarios - Obtener lista de usuarios (Solo Admin)
export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      include: {
        sucursal: {
          select: { nombre: true },
        },
      },
      orderBy: { nombreVendedor: "asc" },
    });

    // Remover la propiedad 'clave' (password hash) por seguridad antes de retornar
    const usuariosSeguros = usuarios.map(({ clave, ...resto }) => resto);

    return NextResponse.json(usuariosSeguros);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/usuarios - Registrar nuevo usuario (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombreUsuario, nombreVendedor, clave, rol, sucursalId, genero, estado } = body;

    if (!nombreUsuario || !nombreVendedor || !clave || !rol) {
      return NextResponse.json(
        { error: "nombreUsuario, nombreVendedor, clave y rol son requeridos" },
        { status: 400 }
      );
    }

    // Verificar si ya existe el nombre de usuario (debe ser único)
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { nombreUsuario },
    });

    if (usuarioExistente) {
      return NextResponse.json(
        { error: "El nombre de usuario ya está registrado" },
        { status: 400 }
      );
    }

    // Encriptar la contraseña con bcryptjs
    const claveEncriptada = await bcrypt.hash(clave, 10);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombreUsuario,
        nombreVendedor,
        clave: claveEncriptada,
        rol,
        sucursalId: sucursalId ? parseInt(sucursalId) : null, // null para admin global
        genero,
        estado: estado || "activo",
      },
    });

    // Retornar el usuario creado excluyendo la clave encriptada
    const { clave: _, ...usuarioCreadoSeguro } = nuevoUsuario;

    return NextResponse.json(usuarioCreadoSeguro, { status: 201 });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
