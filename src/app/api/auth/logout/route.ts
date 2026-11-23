import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  
  // Deleting NextAuth session tokens (both standard and secure)
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");
  
  // Redireccionar a login con un parámetro de error para mostrar un mensaje
  return NextResponse.redirect(
    new URL("/login?error=SessionExpired", process.env.NEXTAUTH_URL || "http://localhost:3000")
  );
}
