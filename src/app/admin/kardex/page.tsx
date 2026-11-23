"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import DatePicker from "@/components/DatePicker";
import SucursalSelector from "@/components/SucursalSelector";
import { 
  Search, 
  RotateCcw,
  Calendar
} from "lucide-react";

interface MovimientoKardex {
  id: number;
  sucursalId: number;
  productoId: number;
  nombreProducto: string;
  fechaMovimiento: string;
  tipoMovimiento: string;
  cantidad: number;
  sucursal: {
    nombre: string;
  };
}

function KardexContent() {
  const searchParams = useSearchParams();
  const sucursalSeleccionada = searchParams.get("sucursalId") || "todos";

  const [movimientos, setMovimientos] = useState<MovimientoKardex[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string[]>([]);
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchKardex = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (sucursalSeleccionada !== "todos") {
        queryParams.set("sucursalId", sucursalSeleccionada);
      }
      if (searchTerm.trim()) {
        queryParams.set("search", searchTerm.trim());
      }
      if (tipoFiltro.length > 0) {
        queryParams.set("tipoMovimiento", tipoFiltro.join(","));
      }
      if (fechaInicio) {
        queryParams.set("fechaInicio", fechaInicio);
      }
      if (fechaFin) {
        queryParams.set("fechaFin", fechaFin);
      }

      const res = await fetch(`/api/kardex?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMovimientos(data);
      }
    } catch (error) {
      console.error("Error al cargar Kardex:", error);
    } finally {
      setLoading(false);
    }
  }, [sucursalSeleccionada, searchTerm, tipoFiltro, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchKardex();
  }, [fetchKardex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleResetFilters = () => {
    setSearchTerm("");
    setTipoFiltro([]);
    setFechaInicio("");
    setFechaFin("");
  };

  const getBadgeClass = (tipo: string) => {
    if (
      tipo === "Ingreso" || 
      tipo.startsWith("Ajuste (+)") || 
      tipo.startsWith("Venta") || 
      tipo === "INGRESO TRANSFERENCIA" || 
      tipo === "INGRESO_TRANSFERENCIA"
    ) {
      return "badge-success";
    }
    if (
      tipo === "Ajuste (-)" || 
      tipo === "SALIDA TRANSFERENCIA" || 
      tipo === "SALIDA_TRANSFERENCIA"
    ) {
      return "badge-danger";
    }
    return "badge-info";
  };

  const formatFecha = (fechaStr: string) => {
    const d = new Date(fechaStr);
    return d.toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }} className="slide-in">
      {/* Encabezado */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>Auditoría de Inventario (Kardex)</h1>
            <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))" }}>
              Historial detallado de ingresos, ajustes y ventas de medicamentos
            </p>
          </div>
          <SucursalSelector />
        </div>
      </div>
      {/* Filtros */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px", overflow: "visible" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "end" }}>
          {/* Búsqueda */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: "260px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Buscar Medicamento:</span>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                ref={searchInputRef}
                type="text"
                className="input-field"
                placeholder="Buscar producto por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: "42px", paddingRight: "60px", width: "100%" }}
              />
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "hsl(var(--muted-foreground))",
                }}
              />
              <div 
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(15, 23, 42, 0.05)",
                  color: "#64748b",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: "6px",
                  pointerEvents: "none",
                  userSelect: "none"
                }}
              >
                F1
              </div>
            </div>
          </div>

          {/* Fecha Inicio */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Fecha Inicio:</span>
            <DatePicker
              value={fechaInicio}
              onChange={setFechaInicio}
              placeholder="Seleccionar"
              width="160px"
            />
          </div>
 
          {/* Fecha Fin */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Fecha Fin:</span>
            <DatePicker
              value={fechaFin}
              onChange={setFechaFin}
              placeholder="Seleccionar"
              width="160px"
            />
          </div>
 
          {/* Resetear Filtros */}
          {(searchTerm || tipoFiltro.length > 0 || fechaInicio || fechaFin) && (
            <button
              onClick={handleResetFilters}
              className="btn btn-outline"
              style={{ padding: "10px 16px", display: "flex", gap: "6px", alignItems: "center", height: "42px" }}
            >
              <RotateCcw size={14} />
              Limpiar
            </button>
          )}

          {/* Tipo de Movimiento */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "240px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Tipo de Movimiento:</span>
            <CustomMultiSelect
              options={[
                { value: "Ingreso", label: "Ingreso" },
                { value: "Registro", label: "Registro Inicial" },
                { value: "Ajuste (+)", label: "Ajuste (+)" },
                { value: "Ajuste (-)", label: "Ajuste (-)" },
                { value: "Venta por unidad", label: "Venta por Unidad" },
                { value: "Venta por caja", label: "Venta por Caja" },
                { value: "Venta por blister", label: "Venta por Blíster" },
                { value: "INGRESO TRANSFERENCIA", label: "Ingreso por Transferencia" },
                { value: "SALIDA TRANSFERENCIA", label: "Salida por Transferencia" },
              ]}
              value={tipoFiltro}
              onChange={(val) => setTipoFiltro(val)}
              placeholder="Todos los Tipos"
              width="240px"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
            Cargando historial de movimientos...
          </div>
        ) : movimientos.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
            No se encontraron movimientos de Kardex con los filtros aplicados.
          </div>
        ) : (
          <table className="table-custom">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Sucursal</th>
                <th>Producto</th>
                <th>Tipo Movimiento</th>
                <th style={{ textAlign: "right" }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => {
                const isNegative = mov.cantidad < 0;
                return (
                  <tr key={mov.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400 }}>
                        <Calendar size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
                        {formatFecha(mov.fechaMovimiento)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 400 }}>
                        {mov.sucursal?.nombre?.replace("Botica Pharma Salud - ", "")}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 400 }}>{mov.nombreProducto}</span>
                    </td>
                    <td>
                      <span className={`badge ${getBadgeClass(mov.tipoMovimiento)}`}>
                        {mov.tipoMovimiento}
                      </span>
                    </td>
                    <td 
                      style={{ 
                        textAlign: "right", 
                        fontWeight: 400, 
                        color: isNegative ? "hsl(var(--danger))" : "hsl(var(--success))",
                        fontSize: "1.05rem" 
                      }}
                    >
                      {isNegative ? "" : "+"}{mov.cantidad}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function KardexPage() {
  return (
    <Suspense fallback={<div style={{ padding: "32px", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Cargando auditoría Kardex...</div>}>
      <KardexContent />
    </Suspense>
  );
}
