"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function SucursalSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sucursales, setSucursales] = useState<any[]>([]);
  
  const currentSucursal = searchParams.get("sucursalId") || "todos";

  useEffect(() => {
    fetch("/api/sucursales")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSucursales(data);
        }
      })
      .catch((err) => console.error("Error al cargar sucursales:", err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val === "todos") {
      params.delete("sucursalId");
    } else {
      params.set("sucursalId", val);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
        Farmacia Activa:
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <select
          className="input-field"
          style={{
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            width: "260px",
            borderRadius: "var(--radius-sm)",
            height: "38px",
            border: "1.5px solid hsl(var(--card-border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
            cursor: "pointer",
            outline: "none",
          }}
          value={currentSucursal}
          onChange={handleChange}
        >
          <option value="todos">🌍 Todas las Sucursales (Consolidado)</option>
          {sucursales.map((suc) => (
            <option key={suc.id} value={suc.id.toString()}>
              🏪 {suc.nombre.replace("Botica Pharma Salud - ", "")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
