"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Edit2, Trash2, X, Scale, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface UnidadMedida {
  id: number;
  nombre: string;
  fechaCreacion: string;
}

export default function AdminUnidadesMedida() {
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modales
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedUnidad, setSelectedUnidad] = useState<UnidadMedida | null>(null);
  useEscapeToClose(showAddModal, useCallback(() => setShowAddModal(false), []));
  useEscapeToClose(!!selectedUnidad, useCallback(() => setSelectedUnidad(null), []));
  useBodyScrollLock(showAddModal || !!selectedUnidad);

  // Formulario creación
  const [nuevoNombre, setNuevoNombre] = useState<string>("");

  // Formulario edición
  const [editNombre, setEditNombre] = useState<string>("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar unidades
  const fetchUnidades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/unidades-medida");
      if (res.ok) {
        const data = await res.json();
        setUnidades(data);
      }
    } catch (error) {
      console.error("Error al cargar unidades de medida:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnidades();
  }, [fetchUnidades]);

  // Atajo de teclado F1 para enfocar el buscador
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

  // Registrar nueva unidad
  const handleAddUnidad = async () => {
    if (!nuevoNombre.trim()) {
      alert("El nombre de la unidad es requerido");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/unidades-medida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNuevoNombre("");
        fetchUnidades();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al registrar unidad de medida:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEditModal = (unidad: UnidadMedida) => {
    setSelectedUnidad(unidad);
    setEditNombre(unidad.nombre);
  };

  // Guardar cambios de edición
  const handleSaveUnidad = async () => {
    if (!selectedUnidad) return;
    if (!editNombre.trim()) {
      alert("El nombre es requerido");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/unidades-medida/${selectedUnidad.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editNombre,
        }),
      });

      if (res.ok) {
        setSelectedUnidad(null);
        fetchUnidades();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al guardar unidad de medida:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar unidad
  const handleDeleteUnidad = async (id: number, nombre: string) => {
    const confirmed = await (window as any).showConfirm(`¿Está seguro de eliminar la unidad de medida "${nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/unidades-medida/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Unidad de medida eliminada correctamente.");
        fetchUnidades();
      } else {
        const errData = await res.json();
        alert(errData.error || "Error al eliminar unidad de medida");
      }
    } catch (error) {
      console.error("Error al eliminar unidad de medida:", error);
    }
  };

  // Filtrar unidades en cliente
  const filteredUnidades = unidades.filter(u =>
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnidades = unidades.length;

  return (
    <>
      <div className="admin-unidades-root" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* CABECERA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: 0 }}>
              Unidades de Medida
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500, marginTop: "4px", margin: 0 }}>
              Gestiona las unidades de concentración o valor (mg, ml, g, UI) del sistema.
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowAddModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#e11d48",
              color: "#ffffff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(225, 29, 72, 0.2)"
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nueva Unidad</span>
          </button>
        </div>

        {/* CONTENEDOR DE FILTRADO Y ESTADÍSTICAS */}
        <div style={{
          display: "flex",
          gap: "24px",
          alignItems: "center",
          background: "#ffffff",
          padding: "16px 24px",
          borderRadius: "16px",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.01)"
        }}>
          {/* Buscador */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, position: "relative" }}>
            <Search size={18} style={{ color: "#94a3b8", position: "absolute", left: "12px" }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre (Presiona F1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 40px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.875rem",
                fontWeight: 500,
                outline: "none"
              }}
            />
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", background: "#f8fafc", padding: "8px 16px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>{totalUnidades}</span>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
          overflow: "hidden"
        }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontWeight: 600 }}>
              Cargando unidades de medida...
            </div>
          ) : filteredUnidades.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              <Scale size={36} style={{ color: "#94a3b8", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, margin: 0 }}>No se encontraron unidades de medida registradas.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>ID</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Unidad</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Fecha Creación</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnidades.map((unidad) => (
                  <tr key={unidad.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px 24px", fontSize: "0.85rem", color: "#64748b", fontWeight: 400 }}>#{unidad.id}</td>
                    <td style={{ padding: "16px 24px", fontSize: "0.85rem", color: "#0f172a", fontWeight: 400 }}>{unidad.nombre}</td>
                    <td style={{ padding: "16px 24px", fontSize: "0.85rem", color: "#64748b" }}>
                      {new Date(unidad.fechaCreacion).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button
                          onClick={() => handleOpenEditModal(unidad)}
                          style={{
                            background: "#f1f5f9",
                            border: "none",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            color: "#475569"
                          }}
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteUnidad(unidad.id, unidad.nombre)}
                          style={{
                            background: "#fef2f2",
                            border: "none",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            color: "#ef4444"
                          }}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL CREACIÓN */}
      {showAddModal && (
        <div className="overlay-bg-blur" style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100
        }}>
          <div className="card" style={{ width: "450px", position: "relative" }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>Nueva Unidad de Medida</h3>
            <div className="form-group">
              <label className="form-label">Nombre de la Unidad</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. mg, ml, g, UI"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button onClick={() => setShowAddModal(false)} className="btn btn-outline" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleAddUnidad}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ flex: 1, opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? "Registrando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {selectedUnidad && (
        <div className="overlay-bg-blur" style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100
        }}>
          <div className="card" style={{ width: "450px", position: "relative" }}>
            <button
              onClick={() => setSelectedUnidad(null)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>Editar Unidad de Medida</h3>
            <div className="form-group">
              <label className="form-label">Nombre de la Unidad</label>
              <input
                type="text"
                className="input-field"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button onClick={() => setSelectedUnidad(null)} className="btn btn-outline" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveUnidad}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ flex: 1, opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
