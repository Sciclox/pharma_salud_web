import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const authMiddleware = NextAuth(authConfig).auth;

export default async function proxy(req: any, event: any) {
  const response = await authMiddleware(req, event);

  if (response instanceof Response) {
    const setCookieHeader = response.headers.get("Set-Cookie");
    if (setCookieHeader) {
      const cookies = response.headers.getSetCookie();
      response.headers.delete("Set-Cookie");

      cookies.forEach((cookie) => {
        if (
          cookie.includes("authjs.session-token") ||
          cookie.includes("next-auth.session-token")
        ) {
          let cleanCookie = cookie
            .replace(/Max-Age=[^;]+;?/gi, "")
            .replace(/Expires=[^;]+;?/gi, "")
            .replace(/;;\s*/g, ";")
            .trim();

          if (cleanCookie.endsWith(";")) {
            cleanCookie = cleanCookie.slice(0, -1);
          }
          response.headers.append("Set-Cookie", cleanCookie);
        } else {
          response.headers.append("Set-Cookie", cookie);
        }
      });
    }
  }

  return response;
}

export const config = {
  // Especifica qué rutas deben pasar por el middleware de autenticación.
  // Evitamos estáticos, favicon, api routes públicas, etc.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
