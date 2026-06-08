"use client";

import { useLocalState } from "@/hooks/useLocalState";
import { LogOut, User, ShoppingCart, Clock, Eye, EyeOff, Receipt, DollarSign } from "lucide-react";
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
            borderColor: showVentas ? "rgba(16, 185, 129, 0.2)" : "rgba(15, 23, 42, 0.08)",
            background: showVentas ? "rgba(16, 185, 129, 0.06)" : "#ffffff",
            color: showVentas ? "#047857" : "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={showVentas ? "Ocultar panel Ventas del Día" : "Mostrar panel Ventas del Día"}
        >
          <Clock size={14} strokeWidth={2.2} />
          <span>Ventas del Día</span>
          {showVentas ? (
            <Eye size={12} strokeWidth={2} style={{ opacity: 0.8 }} />
          ) : (
            <EyeOff size={12} strokeWidth={2} style={{ opacity: 0.5 }} />
          )}
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
            borderColor: showCart ? "rgba(225, 29, 72, 0.2)" : "rgba(15, 23, 42, 0.08)",
            background: showCart ? "rgba(225, 29, 72, 0.04)" : "#ffffff",
            color: showCart ? "#e11d48" : "#64748b",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title={showCart ? "Ocultar panel Carrito" : "Mostrar panel Carrito"}
        >
          <ShoppingCart size={14} strokeWidth={2.2} />
          <span>Carrito</span>
          {showCart ? (
            <Eye size={12} strokeWidth={2} style={{ opacity: 0.8 }} />
          ) : (
            <EyeOff size={12} strokeWidth={2} style={{ opacity: 0.5 }} />
          )}
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
          title="Tickets del día"
        >
          <Receipt size={14} strokeWidth={2.2} />
          <span>Tickets</span>
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
          title="Cierre de caja"
        >
          <DollarSign size={14} strokeWidth={2.2} />
          <span>Cierre</span>
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
        >
          <LogOut size={14} strokeWidth={2.2} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
}
