"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Store, Edit2, Trash2, X, ToggleLeft, ToggleRight, CheckCircle2 } from "lucide-react";

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
  estado: string;
  fechaCreacion: string;
}

export default function AdminSucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalesFiltradas, setSucursalesFiltradas] = useState<Sucursal[]>([]);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Modales - CRUD Sucursal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  
  // Formulario
  const [nombre, setNombre] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");
  const [estado, setEstado] = useState<string>("activo");

  // Cargar lista de sucursales
  const fetchSucursales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sucursales");
      if (res.ok) {
        const data = await res.json();
        setSucursales(data);
        setSucursalesFiltradas(data);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sucursales-updated"));
        }
      }
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSucursales();
  }, [fetchSucursales]);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (!searchQuery) {
      setSucursalesFiltradas(sucursales);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = sucursales.filter(s => 
        s.nombre.toLowerCase().includes(query) ||
        (s.direccion && s.direccion.toLowerCase().includes(query))
      );
      setSucursalesFiltradas(filtered);
    }
  }, [searchQuery, sucursales]);

  // Abrir modal para crear
  const handleOpenCreate = () => {
    setEditingSucursal(null);
    setNombre("");
    setDireccion("");
    setEstado("activo");
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (sucursal: Sucursal) => {
    setEditingSucursal(sucursal);
    setNombre(sucursal.nombre);
    setDireccion(sucursal.direccion || "");
    setEstado(sucursal.estado);
    setShowModal(true);
  };

  // Guardar (Crear o Editar)
  const handleSaveSucursal = async () => {
    if (!nombre) {
      alert("El nombre de la sucursal es requerido");
      return;
    }

    const payload = {
      nombre,
      direccion: direccion || null,
      estado,
    };

    try {
      let res;
      if (editingSucursal) {
        res = await fetch(`/api/sucursales/${editingSucursal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/sucursales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setShowModal(false);
        fetchSucursales();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error al guardar sucursal:", error);
    }
  };

  // Alternar estado activo/inactivo (Desactivación lógica rápida)
  const handleToggleEstado = async (sucursal: Sucursal) => {
    const nuevoEstado = sucursal.estado === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`/api/sucursales/${sucursal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (res.ok) {
        fetchSucursales();
      }
    } catch (error) {
      console.error("Error al alternar estado:", error);
    }
  };

  // Eliminar sucursal (Desactivación permanente)
  const handleDeleteSucursal = async (id: number) => {
    if (!confirm("¿Está seguro de desactivar permanentemente esta sucursal del sistema?")) {
      return;
    }

    try {
      const res = await fetch(`/api/sucursales/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchSucursales();
      } else {
        const data = await res.json();
        alert(`Error al desactivar: ${data.error}`);
      }
    } catch (error) {
      console.error("Error al desactivar sucursal:", error);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. CONTROLES SUPERIORES */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "hsl(var(--card))",
          padding: "20px 24px",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--card-border))"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Gestión de Sucursales</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))" }}>
            Administración de locales, farmacias físicas y disponibilidad del sistema.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Store size={16} />
          Registrar Sucursal
        </button>
      </div>

      {/* 2. BÚSQUEDA EN TIEMPO REAL */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Buscar sucursal por nombre o dirección..."
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

      {/* 3. TABLA DE SUCURSALES */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando locales y sucursales...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Nombre de Sucursal</th>
                <th>Dirección Física</th>
                <th>Fecha de Registro</th>
                <th>Estado</th>
                <th>Bloquear/Activar</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sucursalesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se encontraron sucursales registradas.
                  </td>
                </tr>
              ) : (
                sucursalesFiltradas.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Store size={15} style={{ color: s.estado === "activo" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
                        {s.nombre}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: s.direccion ? "inherit" : "hsl(var(--muted-foreground))" }}>
                      {s.direccion || "Sin dirección registrada"}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}>
                      {new Date(s.fechaCreacion).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })}
                    </td>
                    <td>
                      <span className={`badge ${s.estado === "activo" ? "badge-success" : "badge-danger"}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleEstado(s)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: s.estado === "activo" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}
                      >
                        {s.estado === "activo" ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button 
                          onClick={() => handleOpenEdit(s)}
                          style={{ background: "none", border: "none", color: "hsl(var(--foreground))", cursor: "pointer" }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSucursal(s.id)}
                          style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Crear / Editar Sucursal */}
      {showModal && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="card" style={{ width: "400px", position: "relative", border: "1px solid rgba(15, 23, 42, 0.08)", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)" }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem", fontWeight: 800 }}>
              {editingSucursal ? "Editar Sucursal" : "Registrar Sucursal"}
            </h3>

            <div className="form-group">
              <label className="form-label">Nombre de la Sucursal:</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Botica PharmaSalud Larco"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Dirección física:</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Av. Larco 456, Trujillo"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado:</label>
              <select
                className="input-field"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="activo">Activa</option>
                <option value="inactivo">Inactiva</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveSucursal} style={{ flex: 1.5 }}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
