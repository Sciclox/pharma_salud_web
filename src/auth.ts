import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

function createAuth() {
  try {
    return NextAuth({
      ...authConfig,
      providers: [
        Credentials({
          name: "Credentials",
          credentials: {
            username: { label: "Usuario", type: "text" },
            password: { label: "Contraseña", type: "password" },
          },
          async authorize(credentials) {
            if (!credentials?.username || !credentials?.password) {
              return null;
            }

            try {
              const user = await prisma.usuario.findUnique({
                where: {
                  nombreUsuario: credentials.username as string,
                },
                include: {
                  sucursal: true,
                },
              });

              if (!user || user.estado?.toLowerCase() !== "activo") {
                return null;
              }

              const passwordMatch = await bcrypt.compare(
                credentials.password as string,
                user.clave
              );

              if (!passwordMatch) {
                return null;
              }

              return {
                id: user.id.toString(),
                name: user.nombreVendedor,
                email: user.nombreUsuario,
                role: user.rol,
                sucursalId: user.sucursalId,
                sucursalName: user.sucursal?.nombre || null,
                genero: user.genero,
              };
            } catch (error) {
              console.error("Error en authorize de NextAuth:", error);
              return null;
            }
          },
        }),
      ],
    });
  } catch (error) {
    console.error("Error al inicializar NextAuth:", error);
    throw error;
  }
}

const authInstance = createAuth();
const { handlers, signIn, signOut, auth: nextAuthCall } = authInstance;

// Envolver la función auth para interceptar y validar contra la base de datos en tiempo real
export const auth = async () => {
  const session = await nextAuthCall();
  if (!session || !session.user || !session.user.id) {
    return session;
  }

  try {
    // Buscar usuario en la base de datos PostgreSQL en tiempo real
    const user = await prisma.usuario.findUnique({
      where: {
        id: parseInt(session.user.id),
      },
      include: {
        sucursal: true,
      },
    });

    // Si el usuario ya no existe o su estado ya no es activo, invalidar sesión inmediatamente
    if (!user || user.estado?.toLowerCase() !== "activo") {
      return {
        ...session,
        error: "SessionExpired",
      };
    }

    // Retornar un objeto de sesión clonado con la información fresca de la base de datos
    return {
      ...session,
      user: {
        ...session.user,
        name: user.nombreVendedor,
        role: user.rol,
        sucursalId: user.sucursalId,
        sucursalName: user.sucursal?.nombre || null,
        genero: user.genero,
      },
    };
  } catch (error) {
    console.error("Error al validar sesión en tiempo real:", error);
  }

  return session;
};

export { handlers, signIn, signOut };
