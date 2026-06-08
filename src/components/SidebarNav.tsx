"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  Users, 
  AlertTriangle, 
  BookOpen, 
  Scale, 
  Coins,
  Store,
  Tags,
  Building
} from "lucide-react";

interface BadgeConfig {
  type: "danger" | "info" | "warning";
  text: string;
}

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: BadgeConfig;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sucursalId = searchParams.get("sucursalId");

  // Menu agrupado con badges dinámicos integrados
  const menuSections: MenuSection[] = [
    {
      title: "Consola Central",
      items: [
        { label: "Dashboard Analítico", href: "/admin", icon: <LayoutDashboard size={18} /> },
        { 
          label: "Catálogo Fármacos", 
          href: "/admin/productos", 
          icon: <Package size={18} />
        },
        { label: "Categorías", href: "/admin/categorias", icon: <Tags size={18} /> },
        { label: "Laboratorios", href: "/admin/laboratorios", icon: <Building size={18} /> },
        { label: "Libro Dispensación", href: "/admin/ventas", icon: <Receipt size={18} /> },
        { label: "Control de Personal", href: "/admin/usuarios", icon: <Users size={18} /> },
        { label: "Gestión de Sucursales", href: "/admin/sucursales", icon: <Store size={18} /> },
      ]
    },
    {
      title: "Auditoría & Trazabilidad",
      items: [
        { 
          label: "Lotes & Vencimiento", 
          href: "/admin/vencimiento", 
          icon: <AlertTriangle size={18} />,
          badge: { type: "danger", text: "3" }
        },
        { label: "Historial Kardex", href: "/admin/kardex", icon: <BookOpen size={18} /> },
        { label: "Ajuste de Inventario", href: "/admin/ajustes", icon: <Scale size={18} /> },
      ]
    },
    {
      title: "Operaciones Financieras",
      items: [
        { label: "Arqueos de Caja", href: "/admin/sobrantes", icon: <Coins size={18} /> },
      ]
    }
  ];

  return (
    <nav style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
      {menuSections.map((section, secIdx) => (
        <div key={secIdx} className="nav-section-card">
          <div className="nav-section-title">{section.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              const hrefWithParams = sucursalId ? `${item.href}?sucursalId=${sucursalId}` : item.href;
              
              return (
                <Link
                  key={item.href}
                  href={hrefWithParams}
                  className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                >
                  <span className="nav-icon-wrapper">{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span className={`nav-badge nav-badge-${item.badge.type}`}>
                      {item.badge.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}



      {/* Estilos CSS locales de alta fidelidad para el Tema Claro */}
      <style>{`
        .nav-section-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .nav-section-card:hover {
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.08);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.03);
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 0.86rem;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.65);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          background: transparent;
          border: 1px solid transparent;
        }
        .nav-item:not(.nav-item-active):hover {
          color: #0f172a !important;
          background: rgba(0, 0, 0, 0.015) !important;
          transform: translateY(-1px);
        }
        .nav-item-active {
          color: #e11d48 !important;
          background: rgba(225, 29, 72, 0.05) !important;
          border: 1px solid rgba(225, 29, 72, 0.15) !important;
          box-shadow: 0 2px 8px rgba(225, 29, 72, 0.04) !important;
          font-weight: 700 !important;
        }
        .nav-item-active .nav-icon-wrapper svg {
          color: #e11d48 !important;
          filter: drop-shadow(0 0 4px rgba(225, 29, 72, 0.2));
        }
        .nav-section-title {
          font-size: 0.68rem;
          font-weight: 800;
          color: rgba(15, 23, 42, 0.35);
          letter-spacing: 0.08em;
          padding: 0 10px;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .nav-badge {
          font-size: 0.65rem;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 6px;
          letter-spacing: 0.02em;
        }
        .nav-badge-danger {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.1);
          animation: pulseBadge 2s infinite ease-in-out;
        }
        .nav-badge-info {
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        @keyframes pulseBadge {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }

      `}</style>
    </nav>
  );
}
