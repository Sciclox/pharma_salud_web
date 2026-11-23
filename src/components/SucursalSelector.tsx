"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building, Check, ChevronDown } from "lucide-react";

export default function SucursalSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const currentSucursal = searchParams.get("sucursalId") || "todos";

  useEffect(() => {
    fetch("/api/sucursales")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSucursales(data);
          const currentId = searchParams.get("sucursalId");
          if (currentId && currentId !== "todos") {
            const idNum = parseInt(currentId);
            if (!isNaN(idNum) && !data.some((s: any) => s.id === idNum)) {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("sucursalId");
              router.replace(`${pathname}?${params.toString()}`);
            }
          }
        }
      })
      .catch((err) => console.error("Error al cargar sucursales:", err));
  }, [pathname, refreshTrigger, router, searchParams]);

  useEffect(() => {
    const handleUpdate = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener("sucursales-updated", handleUpdate);
    return () => {
      window.removeEventListener("sucursales-updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (val: string) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (val === "todos") {
      params.delete("sucursalId");
    } else {
      params.set("sucursalId", val);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const normalizeText = (text: string) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredSucursales = sucursales.filter((suc) =>
    normalizeText(suc.nombre).includes(normalizeText(search))
  );

  const showTodas = !search || normalizeText("Todas las Sucursales").includes(normalizeText(search));

  const   selectedName = currentSucursal === "todos"
    ? "Todas las Sucursales"
    : sucursales.find((s) => s.id.toString() === currentSucursal)?.nombre.replace("Botica Pharma Salud - ", "") || "Seleccionar";

  const selDisplay = selectedName;


  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          borderRadius: "10px",
          border: "1.5px solid hsl(var(--card-border))",
          background: "hsl(var(--card))",
          cursor: "pointer",
          color: "hsl(var(--foreground))",
          fontSize: "0.85rem",
          fontWeight: 600,
          transition: "border-color .2s, box-shadow .2s",
          outline: "none",
          minWidth: "220px",
        }}
      >
        <Building size={16} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selDisplay}
        </span>
        <ChevronDown size={15} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 49,
              background: "transparent",
            }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card animate-fade-in"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              zIndex: 50,
              width: "280px",
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              padding: "8px",
              maxHeight: "360px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Buscador */}
            <div style={{ padding: "4px", borderBottom: "1.5px solid rgba(15, 23, 42, 0.06)", marginBottom: "6px", flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Buscar sucursal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredSucursales.length > 0) {
                      handleSelect(filteredSucursales[0].id.toString());
                    } else if (showTodas) {
                      handleSelect("todos");
                    }
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(15, 23, 42, 0.15)",
                  fontSize: "0.82rem",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#f8fafc",
                }}
                autoFocus
              />
            </div>

            <div style={{ overflowY: "auto", flex: 1, maxHeight: "240px" }}>
              {showTodas && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect("todos")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      borderRadius: "8px",
                      background: currentSucursal === "todos" ? "rgba(225, 29, 72, 0.06)" : "transparent",
                      color: "hsl(var(--foreground))",
                      fontSize: "0.85rem",
                      fontWeight: currentSucursal === "todos" ? 700 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background .15s",
                    }}
                    onMouseEnter={(e) => { if (currentSucursal !== "todos") e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Building size={15} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>Todas las Sucursales</span>
                    {currentSucursal === "todos" && <Check size={14} style={{ color: "#e11d48" }} />}
                  </button>

                  {filteredSucursales.length > 0 && (
                    <div style={{ height: "1px", background: "rgba(0,0,0,0.05)", margin: "4px 0" }} />
                  )}
                </>
              )}

              {filteredSucursales.length === 0 && !showTodas ? (
                <div style={{ padding: "12px", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: "0.82rem" }}>
                  Sin resultados
                </div>
              ) : (
                filteredSucursales.map((suc) => {
                  const isActive = currentSucursal === suc.id.toString();
                  const name = suc.nombre.replace("Botica Pharma Salud - ", "");
                  return (
                    <button
                      key={suc.id}
                      type="button"
                      onClick={() => handleSelect(suc.id.toString())}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        borderRadius: "8px",
                        background: isActive ? "rgba(225, 29, 72, 0.06)" : "transparent",
                        color: "hsl(var(--foreground))",
                        fontSize: "0.85rem",
                        fontWeight: isActive ? 700 : 400,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Building size={15} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                      {isActive && <Check size={14} style={{ color: "#e11d48" }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
