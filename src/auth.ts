import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
          // Buscar usuario en base de datos PostgreSQL
          const user = await prisma.usuario.findUnique({
            where: {
              nombreUsuario: credentials.username as string,
            },
            include: {
              sucursal: true,
            },
          });

          // Si el usuario no existe o está inactivo
          if (!user || user.estado?.toLowerCase() !== "activo") {
            return null;
          }

          // Comparar contraseñas (bcrypt hash)
          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.clave
          );

          if (!passwordMatch) {
            return null;
          }

          // Retornar los campos necesarios para la sesión
          return {
            id: user.id.toString(),
            name: user.nombreVendedor,
            email: user.nombreUsuario, // Mapeamos a email para tipos estándar de NextAuth
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
