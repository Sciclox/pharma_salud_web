"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Edit2, Trash2, X, Layers, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface FormaFarmaceutica {
  id: number;
  nombre: string;
  estado: string;
  fechaCreacion: string;
}

export default function AdminFormasFarmaceuticas() {
  const [formas, setFormas] = useState<FormaFarmaceutica[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modales
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedForma, setSelectedForma] = useState<FormaFarmaceutica | null>(null);
  useEscapeToClose(showAddModal, useCallback(() => setShowAddModal(false), []));
  useEscapeToClose(!!selectedForma, useCallback(() => setSelectedForma(null), []));
  useBodyScrollLock(showAddModal || !!selectedForma);

  // Formulario creación
  const [nuevoNombre, setNuevoNombre] = useState<string>("");

  // Formulario edición
  const [editNombre, setEditNombre] = useState<string>("");
  const [editEstado, setEditEstado] = useState<string>("activo");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar formas farmacéuticas
  const fetchFormas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/formas-farmaceuticas");
      if (res.ok) {
        const data = await res.json();
        setFormas(data);
      }
    } catch (error) {
      console.error("Error al cargar formas farmacéuticas:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFormas();
  }, [fetchFormas]);

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

  // Registrar nueva forma
  const handleAddForma = async () => {
    if (!nuevoNombre.trim()) {
      alert("El nombre de la forma farmacéutica es requerido");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/formas-farmaceuticas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNuevoNombre("");
        fetchFormas();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al registrar forma farmacéutica:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEditModal = (forma: FormaFarmaceutica) => {
    setSelectedForma(forma);
    setEditNombre(forma.nombre);
    setEditEstado(forma.estado);
  };

  // Guardar cambios de edición
  const handleSaveForma = async () => {
    if (!selectedForma) return;
    if (!editNombre.trim()) {
      alert("El nombre es requerido");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/formas-farmaceuticas/${selectedForma.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editNombre,
          estado: editEstado,
        }),
      });

      if (res.ok) {
        setSelectedForma(null);
        fetchFormas();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al guardar forma farmacéutica:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar forma farmacéutica
  const handleDeleteForma = async (id: number, nombre: string) => {
    const confirmed = await (window as any).showConfirm(`¿Está seguro de eliminar la forma farmacéutica "${nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/formas-farmaceuticas/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Forma farmacéutica eliminada correctamente.");
        fetchFormas();
      } else {
        const errData = await res.json();
        alert(errData.error || "Error al eliminar forma farmacéutica");
      }
    } catch (error) {
      console.error("Error al eliminar forma farmacéutica:", error);
    }
  };

  // Filtrar formas en cliente
  const filteredFormas = formas.filter(f =>
    f.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalFormas = formas.length;
  const activasCount = formas.filter(f => f.estado === "activo").length;

  return (
    <>
      <div className="admin-formas-root" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* CABECERA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: 0 }}>
              Formas Farmacéuticas
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500, marginTop: "4px", margin: 0 }}>
              Gestiona las formas de presentación (Tableta, Jarabe, etc.) de los medicamentos.
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
            <span>Nueva Forma</span>
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
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>{totalFormas}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", background: "#f0fdf4", padding: "8px 16px", borderRadius: "10px", border: "1px solid #dcfce7" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>Activas</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#166534" }}>{activasCount}</span>
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
              Cargando formas farmacéuticas...
            </div>
          ) : filteredFormas.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
              <Layers size={36} style={{ color: "#94a3b8", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, margin: 0 }}>No se encontraron formas farmacéuticas registradas.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>ID</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nombre</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Estado</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Fecha Creación</th>
                  <th style={{ padding: "16px 24px", fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFormas.map((forma) => (
                  <tr key={forma.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px 24px", fontSize: "0.85rem", color: "#64748b", fontWeight: 400 }}>#{forma.id}</td>
                    <td style={{ padding: "16px 24px", fontSize: "0.85rem", color: "#0f172a", fontWeight: 400 }}>{forma.nombre}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: "8px",
                        background: forma.estado === "activo" ? "#ecfdf5" : "#fef2f2",
                        color: forma.estado === "activo" ? "#10b981" : "#ef4444",
                        border: `1px solid ${forma.estado === "activo" ? "#d1fae5" : "#fee2e2"}`
                      }}>
                        {forma.estado === "activo" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: "0.85rem", color: "#64748b" }}>
                      {new Date(forma.fechaCreacion).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px" }}>
                        <button
                          onClick={() => handleOpenEditModal(forma)}
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
                          onClick={() => handleDeleteForma(forma.id, forma.nombre)}
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
            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>Nueva Forma Farmacéutica</h3>
            <div className="form-group">
              <label className="form-label">Nombre de la Forma</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Tableta, Jarabe, Inyectable"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button onClick={() => setShowAddModal(false)} className="btn btn-outline" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleAddForma}
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
      {selectedForma && (
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
              onClick={() => setSelectedForma(null)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>Editar Forma Farmacéutica</h3>
            <div className="form-group">
              <label className="form-label">Nombre de la Forma</label>
              <input
                type="text"
                className="input-field"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                value={editEstado}
                onChange={(e) => setEditEstado(e.target.value)}
                className="input-field"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button onClick={() => setSelectedForma(null)} className="btn btn-outline" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleSaveForma}
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
