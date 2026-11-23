import { auth } from "@/auth";
import { redirect } from "next/navigation";
import VendedorHeader from "./VendedorHeader";

export default async function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.error === "SessionExpired") {
    redirect("/api/auth/logout");
  }

  // Redirigir a login si no hay sesión
  if (!session) {
    redirect("/login");
  }

  // Lógica de saludo dinámica basada en el género (o por defecto)
  const nombre = session.user.name || "Usuario";
  const genero = session.user.genero?.toLowerCase() || "";
  const saludo = genero === "femenino" ? "Bienvenida" : "Bienvenido";

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header Premium (Client Component with toggles) */}
      <VendedorHeader nombre={nombre} saludo={saludo} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
