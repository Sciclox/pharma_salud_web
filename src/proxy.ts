import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Especifica qué rutas deben pasar por el middleware de autenticación.
  // Evitamos estáticos, favicon, api routes públicas, etc.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
