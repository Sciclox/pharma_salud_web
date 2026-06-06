import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Store, User, Receipt, DollarSign } from "lucide-react";

export default async function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirigir a login si no hay sesión
  if (!session) {
    redirect("/login");
  }

  // Lógica de saludo dinámica basada en el género (o por defecto)
  const nombre = session.user.name || "Usuario";
  const saludo = "Bienvenido(a)"; // En producción se puede cruzar con la BD si es necesario,
  // por ahora usamos un saludo neutral y profesional con el nombre del vendedor.

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header Premium (Glassmorphism) */}
      <header 
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          background: "var(--glass-bg)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid hsl(var(--card-border))",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Lado Izquierdo: Branding & Sucursal */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span 
              style={{
                background: "hsl(var(--primary))",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                fontWeight: 800,
                fontSize: "1.2rem",
                letterSpacing: "-0.05em",
                boxShadow: "var(--shadow-primary)",
              }}
            >
              +
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
                PHARMA SALUD
              </span>
              <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
                RUC: 10427847118
              </span>
            </div>
          </div>

          {/* Badge de Sucursal */}
          <div 
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "hsl(var(--secondary))",
              padding: "6px 14px",
              borderRadius: "50px",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "hsl(var(--secondary-foreground))",
            }}
          >
            <Store size={14} />
            {session.user.sucursalName || "Sucursal Global"}
          </div>
        </div>

        {/* Lado Derecho: Vendedor, Métricas e Interacciones */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Info del Vendedor */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div 
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <User size={18} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", textAlign: "right" }}>
              <span style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
                {saludo},
              </span>
              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                {nombre}
              </span>
            </div>
          </div>

          <div 
            style={{
              height: "24px",
              width: "1px",
              background: "hsl(var(--card-border))",
            }}
          />

          {/* Formulario de salida / Cierre de sesión */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button 
              type="submit" 
              className="btn btn-outline"
              style={{
                padding: "8px 14px",
                fontSize: "0.85rem",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <LogOut size={14} />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
