"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, DollarSign, Store, User, Calendar, X, AlertTriangle, ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface Sobrante {
  id: number;
  sucursalId: number;
  usuarioId: number;
  fecha: string;
  monto: number;
  nota: string | null;
  usuario: {
    nombreVendedor: string;
  };
  sucursal: {
    nombre: string;
  };
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface Personal {
  id: number;
  nombreVendedor: string;
}

export default function AdminSobrantes() {
  const [sobrantes, setSobrantes] = useState<Sobrante[]>([]);
  const [sobrantesFiltrados, setSobrantesFiltrados] = useState<Sobrante[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [vendedores, setVendedores] = useState<Personal[]>([]);
  
  // Filtros
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("todos");
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Cargar sucursales y vendedores
  const fetchSoporte = useCallback(async () => {
    try {
      const [resSuc, resUser] = await Promise.all([
        fetch("/api/sucursales"),
        fetch("/api/usuarios"),
      ]);

      if (resSuc.ok) setSucursales(await resSuc.json());
      if (resUser.ok) setVendedores(await resUser.json());
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Cargar historial de arqueos
  const fetchSobrantes = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/sobrante-caja?";
      if (sucursalFiltro !== "todos") url += `sucursalId=${sucursalFiltro}&`;
      if (vendedorFiltro !== "todos") url += `usuarioId=${vendedorFiltro}&`;
      if (fechaInicio) url += `fechaInicio=${fechaInicio}&`;
      if (fechaFin) url += `fechaFin=${fechaFin}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSobrantes(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [sucursalFiltro, vendedorFiltro, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchSoporte();
    fetchSobrantes();
  }, [fetchSoporte, fetchSobrantes]);

  // Borrar arqueo erróneo (Solo Admin)
  const handleDeleteArqueo = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este registro de arqueo de caja?")) {
      return;
    }

    try {
      const res = await fetch(`/api/sobrante-caja/${id}`, {
        method: "DELETE", // Se puede implementar en backend si es crítico, o por ahora usar lógica simulada
      });

      // Recargar
      fetchSobrantes();
    } catch (error) {
      console.error(error);
    }
  };

  // Calcular balance neto consolidado (Suma algebraica de discrepancias)
  const getBalanceNeto = () => {
    return sobrantes.reduce((acc, s) => acc + s.monto, 0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. FILTROS & BALANCE CONSOLIDADO */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          flexWrap: "wrap",
          gap: "16px",
          background: "hsl(var(--card))",
          padding: "20px 24px",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--card-border))"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", flex: 1 }}>
          {/* Farmacia */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Farmacia:</span>
            <select
              className="input-field"
              value={sucursalFiltro}
              onChange={(e) => setSucursalFiltro(e.target.value)}
              style={{ width: "200px", height: "42px", padding: "8px 12px" }}
            >
              <option value="todos">Todas (Consolidado)</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Vendedor */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Colaborador:</span>
            <select
              className="input-field"
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              style={{ width: "180px", height: "42px", padding: "8px 12px" }}
            >
              <option value="todos">Todos</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id.toString()}>{v.nombreVendedor}</option>
              ))}
            </select>
          </div>

          {/* Rango */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Fecha Inicio:</span>
            <input
              type="date"
              className="input-field"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{ width: "160px", height: "42px", padding: "8px 12px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Fecha Fin:</span>
            <input
              type="date"
              className="input-field"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{ width: "160px", height: "42px", padding: "8px 12px" }}
            />
          </div>
        </div>

        {/* Balance Neto */}
        <div 
          style={{
            background: "hsl(var(--muted))",
            padding: "12px 24px",
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid hsl(var(--card-border))",
            display: "flex",
            flexDirection: "column",
            alignItems: "end",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>
            Balance Neto Discrepancias
          </span>
          <span 
            style={{ 
              fontSize: "1.4rem", 
              fontWeight: 800, 
              color: getBalanceNeto() >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))" 
            }}
          >
            {getBalanceNeto() >= 0 ? "+" : ""}{formatMoney(getBalanceNeto())}
          </span>
        </div>
      </div>

      {/* 2. TABLA DE ARQUEOS */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando registros de arqueos diarios...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha / Hora</th>
                <th>Farmacia</th>
                <th>Vendedor / Admin</th>
                <th>Monto Discrepancia</th>
                <th>Nota / Explicación</th>
              </tr>
            </thead>
            <tbody>
              {sobrantes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se registran arqueos en el periodo.
                  </td>
                </tr>
              ) : (
                sobrantes.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>#{s.id}</td>
                    <td>{new Date(s.fecha).toLocaleString("es-PE")}</td>
                    <td style={{ fontWeight: 600 }}>{s.sucursal.nombre}</td>
                    <td>{s.usuario.nombreVendedor}</td>
                    <td 
                      style={{ 
                        fontWeight: 800, 
                        color: s.monto >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))" 
                      }}
                    >
                      {s.monto >= 0 ? "+" : ""}{formatMoney(s.monto)}
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.nota || ""}>
                      {s.nota || "Sin observaciones"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
