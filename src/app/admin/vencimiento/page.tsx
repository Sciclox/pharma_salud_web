"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, AlertTriangle, Calendar, Plus, Trash2, X, Store, CheckCircle2 } from "lucide-react";
import { formatAgotamiento } from "@/lib/format";

interface Lote {
  id: number;
  sucursalId: number;
  productoId: number;
  fechaVencimiento: string;
  cantidad: number;
  producto: {
    nombreProducto: string;
    tipoProducto: string | null;
  };
  sucursal: {
    nombre: string;
  };
}

interface Product {
  id: number;
  nombreProducto: string;
}

interface Sucursal {
  id: number;
  nombre: string;
}

export default function AdminVencimientos() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [lotesFiltrados, setLotesFiltrados] = useState<Lote[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  
  // Filtros
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("por-vencer"); // "vencidos" | "por-vencer" | "todos"
  const [loading, setLoading] = useState<boolean>(true);

  // Modal para agregar lote
  const [showAddLoteModal, setShowAddLoteModal] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [sucursalLote, setSucursalLote] = useState<string>("1");
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("");
  const [cantidadLote, setCantidadLote] = useState<string>("100");

  // Cargar datos de soporte
  const fetchSoporte = useCallback(async () => {
    try {
      const [resSuc, resProd] = await Promise.all([
        fetch("/api/sucursales"),
        fetch("/api/productos"),
      ]);

      if (resSuc.ok) {
        const data = await resSuc.json();
        setSucursales(data);
        if (data.length > 0) setSucursalLote(data[0].id.toString());
      }
      if (resProd.ok) setProductos(await resProd.json());
    } catch (error) {
      console.error("Error al obtener datos de soporte:", error);
    }
  }, []);

  // Cargar lotes de vencimiento
  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/fecha-vencimiento?";
      if (sucursalSeleccionada !== "todos") url += `sucursalId=${sucursalSeleccionada}&`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLotes(data);
      }
    } catch (error) {
      console.error("Error al cargar lotes:", error);
    } finally {
      setLoading(false);
    }
  }, [sucursalSeleccionada]);

  useEffect(() => {
    fetchSoporte();
    fetchLotes();
  }, [fetchSoporte, fetchLotes]);

  // Filtrado reactivo en el cliente
  const filterLotes = useCallback(() => {
    let list = [...lotes];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const unMesDespues = new Date();
    unMesDespues.setDate(hoy.getDate() + 30);

    // 1. Filtrar por búsqueda de nombre de producto
    if (searchQuery) {
      list = list.filter(l => l.producto.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // 2. Filtrar por pestañas de tiempo
    if (activeTab === "vencidos") {
      // Vencidos: fechaVencimiento < hoy
      list = list.filter(l => new Date(l.fechaVencimiento) < hoy);
    } else if (activeTab === "por-vencer") {
      // Por vencer (30 días): hoy <= fechaVencimiento <= hoy + 30 días
      list = list.filter(l => {
        const date = new Date(l.fechaVencimiento);
        return date >= hoy && date <= unMesDespues;
      });
    }

    setLotesFiltrados(list);
  }, [lotes, searchQuery, activeTab]);

  useEffect(() => {
    filterLotes();
  }, [filterLotes]);

  // Agregar lote
  const handleAddLote = async () => {
    if (!selectedProductId || !fechaVencimiento || !cantidadLote) {
      alert("Todos los campos son requeridos");
      return;
    }

    try {
      const res = await fetch("/api/fecha-vencimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: parseInt(selectedProductId),
          sucursalId: parseInt(sucursalLote),
          fechaVencimiento,
          cantidad: parseInt(cantidadLote),
        }),
      });

      if (res.ok) {
        setShowAddLoteModal(false);
        setFechaVencimiento("");
        setCantidadLote("100");
        fetchLotes(); // Recargar
      } else {
        alert("Error al registrar lote de vencimiento");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Eliminar lote
  const handleDeleteLote = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este lote de vencimiento? Se descontará automáticamente su stock correspondiente del stock general físico en la sucursal de origen para mantener consistencia.")) {
      return;
    }

    try {
      const res = await fetch(`/api/fecha-vencimiento/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchLotes();
      } else {
        alert("Error al eliminar lote");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. FILTROS & CONTROLES */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "hsl(var(--card))",
          padding: "20px 24px",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--card-border))"
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
              Farmacia a consultar:
            </span>
            <select
              className="input-field"
              value={sucursalSeleccionada}
              onChange={(e) => setSucursalSeleccionada(e.target.value)}
              style={{ width: "220px", height: "42px", padding: "8px 12px" }}
            >
              <option value="todos">🌍 Todas las sucursales</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddLoteModal(true)} style={{ padding: "10px 16px" }}>
          <Plus size={16} />
          Ingresar Nuevo Lote
        </button>
      </div>

      {/* 2. PESTAÑAS (3 Tabs) */}
      <div 
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1.5px solid hsl(var(--card-border))",
          paddingBottom: "2px"
        }}
      >
        <button 
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "por-vencer" ? "3px solid hsl(var(--primary))" : "none",
            fontWeight: 700,
            cursor: "pointer",
            color: activeTab === "por-vencer" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
          }}
          onClick={() => setActiveTab("por-vencer")}
        >
          Por Vencer (30 días)
        </button>
        <button 
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "vencidos" ? "3px solid hsl(var(--primary))" : "none",
            fontWeight: 700,
            cursor: "pointer",
            color: activeTab === "vencidos" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
          }}
          onClick={() => setActiveTab("vencidos")}
        >
          Ya Vencidos
        </button>
        <button 
          style={{
            padding: "12px 20px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "todos" ? "3px solid hsl(var(--primary))" : "none",
            fontWeight: 700,
            cursor: "pointer",
            color: activeTab === "todos" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
          }}
          onClick={() => setActiveTab("todos")}
        >
          Todos los lotes
        </button>
      </div>

      {/* 3. BÚSQUEDA RAPIDA */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Buscar lote por medicamento o lote específico..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: "46px" }}
        />
        <Search 
          size={18} 
          style={{ 
            position: "absolute", 
            left: "16px", 
            top: "50%", 
            transform: "translateY(-50%)", 
            color: "hsl(var(--muted-foreground))" 
          }} 
        />
      </div>

      {/* 4. TABLA DE LOTES */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Consultando inventario de lotes y fechas de vencimiento...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th>Farmacia</th>
                <th>Fecha Vencimiento</th>
                <th>Lote Cantidad</th>
                <th>Tiempo Restante</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {lotesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se registran lotes en este filtro.
                  </td>
                </tr>
              ) : (
                lotesFiltrados.map((lote) => {
                  const hoy = new Date();
                  hoy.setHours(0, 0, 0, 0);
                  const vDate = new Date(lote.fechaVencimiento);
                  
                  const diffTime = vDate.getTime() - hoy.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  const estaVencido = vDate < hoy;
                  const estaPorVencer = diffDays <= 30 && !estaVencido;

                  const badgeClass = estaVencido ? "badge-danger" : estaPorVencer ? "badge-warning" : "badge-success";
                  const estadoTxt = estaVencido ? "Vencido" : estaPorVencer ? "Por vencer" : "Óptimo";

                  return (
                    <tr key={lote.id}>
                      <td style={{ fontWeight: 700 }}>{lote.producto.nombreProducto}</td>
                      <td style={{ fontWeight: 600 }}>{lote.sucursal.nombre}</td>
                      <td style={{ fontWeight: 600 }}>{vDate.toLocaleDateString("es-PE")}</td>
                      <td style={{ fontWeight: 700 }}>{lote.cantidad} und</td>
                      <td style={{ fontWeight: 600 }}>
                        {estaVencido 
                          ? `Vencido hace ${formatAgotamiento(Math.abs(diffDays))}` 
                          : `Faltan ${formatAgotamiento(diffDays)}`}
                      </td>
                      <td>
                        <span className={`badge ${badgeClass}`}>{estadoTxt}</span>
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDeleteLote(lote.id)}
                          style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer" }}
                          title="Eliminar este lote y descontar del inventario general"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Ingresar Lote */}
      {showAddLoteModal && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="card" style={{ width: "450px", position: "relative" }}>
            <button 
              onClick={() => setShowAddLoteModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>
              Registrar Lote de Vencimiento
            </h3>

            <div className="form-group">
              <label className="form-label">Medicamento:</label>
              <select
                className="input-field"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">Seleccione producto...</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.nombreProducto}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Farmacia Destino:</label>
              <select
                className="input-field"
                value={sucursalLote}
                onChange={(e) => setSucursalLote(e.target.value)}
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Fecha Vencimiento:</label>
                <input
                  type="date"
                  className="input-field"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Cantidad (Unidades):</label>
                <input
                  type="number"
                  className="input-field"
                  value={cantidadLote}
                  onChange={(e) => setCantidadLote(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowAddLoteModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleAddLote} style={{ flex: 1 }}>
                Registrar Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
