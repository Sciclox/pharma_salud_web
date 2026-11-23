"use client";

import { useEffect } from "react";
import { useLocalState } from "@/hooks/useLocalState";
import { LogOut, ShoppingCart, Clock, Receipt, DollarSign, ClipboardList } from "lucide-react";
import { signOut } from "next-auth/react";

interface VendedorHeaderProps {
  nombre: string;
  saludo: string;
}

export default function VendedorHeader({ nombre, saludo }: VendedorHeaderProps) {
  const [showVentas, setShowVentas] = useLocalState("show-ventas-dia", true);
  const [showCart, setShowCart] = useLocalState("show-cart", true);

  const handleLogout = async () => {
    await signOut({ redirectTo: "/login" });
  };

  const handleOpenTickets = () => {
    window.dispatchEvent(new CustomEvent("pos-open-tickets"));
  };

  const handleOpenArqueo = () => {
    window.dispatchEvent(new CustomEvent("pos-open-arqueo"));
  };

  const handleOpenPedido = () => {
    window.dispatchEvent(new CustomEvent("pos-open-pedido"));
  };

  // Escuchar atajos de teclado globales (F2 - F7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "F2":
          e.preventDefault();
          setShowVentas(!showVentas);
          break;
        case "F3":
          e.preventDefault();
          setShowCart(!showCart);
          break;
        case "F4":
          e.preventDefault();
          handleOpenTickets();
          break;
        case "F5":
          e.preventDefault();
          handleOpenPedido();
          break;
        case "F6":
          e.preventDefault();
          handleOpenArqueo();
          break;
        case "F7":
          e.preventDefault();
          handleLogout();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showVentas, showCart]);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 32px",
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
      }}
    >
      {/* Lado Izquierdo: Nombre de la vendedora */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "3.5px",
            height: "28px",
            background: "#e11d48",
            borderRadius: "99px",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>
            {saludo},
          </span>
          <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0f172a" }}>
            {nombre}
          </span>
        </div>
      </div>

      {/* Lado Derecho: Controles de paneles, acciones del POS y Cerrar sesión */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Toggle Ventas del Día */}
        <button
          onClick={() => setShowVentas(!showVentas)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "8px",
            border: "1.5px solid",
            borderColor: showVentas ? "#111827" : "rgba(15, 23, 42, 0.08)",
            background: showVentas ? "#111827" : "#ffffff",
            color: showVentas ? "#ffffff" : "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={showVentas ? "Ocultar panel Ventas del Día [F2]" : "Mostrar panel Ventas del Día [F2]"}
        >
          <Clock size={14} strokeWidth={2.2} />
          <span>Ventas del Día</span>
          <kbd
            style={{
              fontSize: "0.65rem",
              background: showVentas ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.05)",
              color: showVentas ? "#ffffff" : "#64748b",
              padding: "2px 5px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontWeight: 600,
              border: showVentas ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            F2
          </kbd>
        </button>

        {/* Toggle Carrito */}
        <button
          onClick={() => setShowCart(!showCart)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "8px",
            border: "1.5px solid",
            borderColor: showCart ? "#111827" : "rgba(15, 23, 42, 0.08)",
            background: showCart ? "#111827" : "#ffffff",
            color: showCart ? "#ffffff" : "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={showCart ? "Ocultar panel Carrito [F3]" : "Mostrar panel Carrito [F3]"}
        >
          <ShoppingCart size={14} strokeWidth={2.2} />
          <span>Carrito</span>
          <kbd
            style={{
              fontSize: "0.65rem",
              background: showCart ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.05)",
              color: showCart ? "#ffffff" : "#64748b",
              padding: "2px 5px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontWeight: 600,
              border: showCart ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            F3
          </kbd>
        </button>

        {/* Botón Tickets */}
        <button
          onClick={handleOpenTickets}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "8px",
            border: "1.5px solid rgba(15, 23, 42, 0.08)",
            background: "#ffffff",
            color: "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Tickets del día [F4]"
        >
          <Receipt size={14} strokeWidth={2.2} />
          <span>Tickets</span>
          <kbd
            style={{
              fontSize: "0.65rem",
              background: "rgba(15, 23, 42, 0.05)",
              color: "#64748b",
              padding: "2px 5px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontWeight: 600,
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            F4
          </kbd>
        </button>

        {/* Botón Pedido */}
        <button
          onClick={handleOpenPedido}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "8px",
            border: "1.5px solid rgba(15, 23, 42, 0.08)",
            background: "#ffffff",
            color: "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Solicitar orden de compra [F5]"
        >
          <ClipboardList size={14} strokeWidth={2.2} />
          <span>Pedido</span>
          <kbd
            style={{
              fontSize: "0.65rem",
              background: "rgba(15, 23, 42, 0.05)",
              color: "#64748b",
              padding: "2px 5px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontWeight: 600,
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            F5
          </kbd>
        </button>

        {/* Botón Cierre */}
        <button
          onClick={handleOpenArqueo}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "8px",
            border: "1.5px solid rgba(15, 23, 42, 0.08)",
            background: "#ffffff",
            color: "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Cierre de caja [F6]"
        >
          <DollarSign size={14} strokeWidth={2.2} />
          <span>Cierre</span>
          <kbd
            style={{
              fontSize: "0.65rem",
              background: "rgba(15, 23, 42, 0.05)",
              color: "#64748b",
              padding: "2px 5px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontWeight: 600,
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            F6
          </kbd>
        </button>

        {/* Divisor vertical */}
        <div style={{ width: "1px", height: "24px", background: "rgba(15, 23, 42, 0.08)" }} />

        {/* Cerrar Sesión */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            fontSize: "0.82rem",
            fontWeight: 700,
            borderRadius: "8px",
            background: "#ffffff",
            border: "1.5px solid rgba(15, 23, 42, 0.08)",
            color: "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Cerrar sesión [F7]"
        >
          <LogOut size={14} strokeWidth={2.2} />
          <span>Cerrar Sesión</span>
          <kbd
            style={{
              fontSize: "0.65rem",
              background: "rgba(15, 23, 42, 0.05)",
              color: "#64748b",
              padding: "2px 5px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontWeight: 600,
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            F7
          </kbd>
        </button>
      </div>
    </header>
  );
}
