"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  const [tipoFiltro, setTipoFiltro] = useState<string>("");

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
      if (tipoFiltro) {
        queryParams.set("tipoMovimiento", tipoFiltro);
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
  }, [sucursalSeleccionada, searchTerm, tipoFiltro]);

  useEffect(() => {
    fetchKardex();
  }, [fetchKardex]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setTipoFiltro("");
  };

  const getBadgeClass = (tipo: string) => {
    if (tipo === "Ingreso" || tipo.startsWith("Ajuste (+)") || tipo.startsWith("Venta")) {
      return "badge-success";
    }
    if (tipo === "Ajuste (-)") {
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
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>Auditoría de Inventario (Kardex)</h1>
        <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))" }}>
          Historial detallado de ingresos, ajustes y ventas de medicamentos
        </p>
      </div>

      {/* Filtros */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
          {/* Búsqueda */}
          <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
            <input
              type="text"
              className="input-field"
              placeholder="Buscar producto por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "42px" }}
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
          </div>

          {/* Tipo de Movimiento */}
          <div style={{ width: "220px" }}>
            <select
              className="input-field"
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              <option value="">⚙️ Todos los Tipos</option>
              <option value="Ingreso">📥 Ingreso</option>
              <option value="Registro">📝 Registro Inicial</option>
              <option value="Ajuste (+)">📈 Ajuste (+)</option>
              <option value="Ajuste (-)">📉 Ajuste (-)</option>
              <option value="Venta por unidad">💊 Venta por Unidad</option>
              <option value="Venta por caja">📦 Venta por Caja</option>
              <option value="Venta por blister">💳 Venta por Blíster</option>
            </select>
          </div>

          {/* Resetear Filtros */}
          {(searchTerm || tipoFiltro) && (
            <button
              onClick={handleResetFilters}
              className="btn btn-outline"
              style={{ padding: "10px 16px", display: "flex", gap: "6px", alignItems: "center" }}
            >
              <RotateCcw size={14} />
              Limpiar
            </button>
          )}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                        <Calendar size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
                        {formatFecha(mov.fechaMovimiento)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700 }}>
                        {mov.sucursal?.nombre?.replace("Botica Pharma Salud - ", "")}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800 }}>{mov.nombreProducto}</span>
                    </td>
                    <td>
                      <span className={`badge ${getBadgeClass(mov.tipoMovimiento)}`}>
                        {mov.tipoMovimiento}
                      </span>
                    </td>
                    <td 
                      style={{ 
                        textAlign: "right", 
                        fontWeight: 800, 
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
