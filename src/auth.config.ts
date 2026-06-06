import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApiRoute = nextUrl.pathname.startsWith("/api");
      const isLoginRoute = nextUrl.pathname.startsWith("/login");
      const isPublicRoute = nextUrl.pathname === "/"; // Home o landing, si hubiera

      // Si es la ruta de login y está autenticado, redirigir al panel correspondiente
      if (isLoginRoute && isLoggedIn) {
        const role = auth?.user?.role;
        if (role === "Administrador") {
          return Response.redirect(new URL("/admin", nextUrl));
        } else {
          return Response.redirect(new URL("/vendedor", nextUrl));
        }
      }

      // Proteger rutas de admin
      if (nextUrl.pathname.startsWith("/admin")) {
        if (!isLoggedIn) return false;
        return auth?.user?.role === "Administrador";
      }

      // Proteger rutas de vendedor (POS)
      if (nextUrl.pathname.startsWith("/vendedor")) {
        if (!isLoggedIn) return false;
        // Tanto vendedores como administradores pueden acceder al POS si es necesario,
        // pero principalmente los vendedores. Aquí permitiremos ambos para flexibilidad,
        // pero validamos que esté logueado.
        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sucursalId = user.sucursalId;
        token.sucursalName = user.sucursalName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.sucursalId = token.sucursalId as number | null;
        session.user.sucursalName = token.sucursalName as string | null;
      }
      return session;
    },
  },
  providers: [], // Configurado en auth.ts
} satisfies NextAuthConfig;
