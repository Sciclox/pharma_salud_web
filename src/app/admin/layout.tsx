import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { 
  User,
  LogOut
} from "lucide-react";
import SucursalSelector from "@/components/SucursalSelector";
import SidebarNav from "@/components/SidebarNav";
import LogoFarmacia from "@/components/LogoFarmacia";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirigir a login si no está autenticado o no es Administrador
  if (!session || session.user.role !== "Administrador") {
    redirect("/login");
  }

  const nombre = session.user.name || "Administrador";

  return (
    <div className="app-container" style={{ minHeight: "100vh", backgroundColor: "hsl(var(--background))" }}>
      {/* SIDEBAR LATERAL (Premium Glassmorphism) */}
      <aside 
        style={{
          width: "280px",
          background: "hsl(var(--card))",
          borderRight: "1px solid hsl(var(--card-border))",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 40,
        }}
      >
        {/* Logo corporativo */}
        <div 
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid hsl(var(--card-border))",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <LogoFarmacia size={36} glow={false} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.02em", color: "hsl(var(--foreground))" }}>
              PHARMA SALUD
            </span>
            <span style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))", fontWeight: 800, letterSpacing: "0.02em" }}>
              ADMINISTRACIÓN
            </span>
          </div>
        </div>

        {/* Links de navegación */}
        <SidebarNav />

        {/* Perfil del Administrador (Footer de Sidebar) */}
        <div 
          style={{
            padding: "20px 24px",
            borderTop: "1px solid hsl(var(--card-border))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
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
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {nombre}
              </span>
              <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
                Administrador
              </span>
            </div>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button 
              type="submit" 
              style={{
                background: "none",
                border: "none",
                color: "hsl(var(--muted-foreground))",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>
        {/* Cabecera del Contenido (Filtro de Sucursal) */}
        <header 
          style={{
            height: "76px",
            background: "hsl(var(--card) / 0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid hsl(var(--card-border))",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            Consola Centralizada
          </h2>

          {/* Selector de Sucursal Multi-Tenant */}
          <SucursalSelector />
        </header>

        {/* Cuerpo del Contenido */}
        <main style={{ flex: 1, padding: "36px 32px", overflowY: "auto" }} className="fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

// Icono rápido para la sidebar
function DollarSignIcon() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", fontWeight: "bold", fontSize: "0.95rem" }}>
      $
    </div>
  );
}
