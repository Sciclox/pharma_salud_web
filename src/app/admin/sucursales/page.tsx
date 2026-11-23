"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Store, Edit2, Trash2, X, ToggleLeft, ToggleRight, CheckCircle2 } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
  afiliada: string | null;
  estado: string;
  fechaCreacion: string;
}

export default function AdminSucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalesFiltradas, setSucursalesFiltradas] = useState<Sucursal[]>([]);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modales - CRUD Sucursal
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  useEscapeToClose(showModal, useCallback(() => setShowModal(false), []));
  useBodyScrollLock(showModal);
  
  // Formulario
  const [nombre, setNombre] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");
  const [afiliada, setAfiliada] = useState<string>("");
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
        (s.direccion && s.direccion.toLowerCase().includes(query)) ||
        (s.afiliada && s.afiliada.toLowerCase().includes(query))
      );
      setSucursalesFiltradas(filtered);
    }
  }, [searchQuery, sucursales]);

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

  // Abrir modal para crear
  const handleOpenCreate = () => {
    setEditingSucursal(null);
    setNombre("");
    setDireccion("");
    setAfiliada("");
    setEstado("activo");
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (sucursal: Sucursal) => {
    setEditingSucursal(sucursal);
    setNombre(sucursal.nombre);
    setDireccion(sucursal.direccion || "");
    setAfiliada(sucursal.afiliada || "");
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
      afiliada: afiliada || null,
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

  // Eliminar sucursal (solo si no tiene datos relacionados)
  const handleDeleteSucursal = async (id: number) => {
    const confirmed = await (window as any).showConfirm("¿Está seguro de eliminar esta sucursal del sistema? Solo se eliminará si no tiene registros asociados (ventas, inventarios, usuarios, etc.).");
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/sucursales/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Sucursal eliminada correctamente.");
        fetchSucursales();
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar la sucursal.");
      }
    } catch (error) {
      console.error("Error al eliminar sucursal:", error);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. CONTROLES SUPERIORES */}
      <div className="admin-header-row">
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 className="admin-page-title">Gestión de Sucursales</h1>
          <p className="admin-page-subtitle">
            Administración de locales, farmacias físicas y disponibilidad del sistema.
          </p>
        </div>

        <div className="admin-header-actions">
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Store size={16} />
            Registrar Sucursal
          </button>
        </div>
      </div>

      {/* 2. BÚSQUEDA EN TIEMPO REAL */}
      <div className="admin-filter-card">
        <div className="admin-search-box-wrap">
          <Search size={18} className="admin-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="admin-search-input"
            placeholder="Buscar sucursal por nombre, dirección o afiliada..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="admin-search-clear-btn" 
              onClick={() => setSearchQuery("")}
              style={{ right: "44px", top: "50%", transform: "translateY(-50%)" }}
            >
              <X size={16} />
            </button>
          )}
          <div className="admin-search-shortcut-badge">F1</div>
        </div>
      </div>

      {/* 3. TABLA DE SUCURSALES */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando locales y sucursales...</p>
        </div>
      ) : (
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre de Sucursal</th>
                  <th>Dirección Física</th>
                  <th>Afiliada</th>
                  <th>Fecha de Registro</th>
                  <th>Estado</th>
                  <th className="text-center">Bloquear/Activar</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sucursalesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      No se encontraron sucursales registradas.
                    </td>
                  </tr>
                ) : (
                  sucursalesFiltradas.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 400, color: "#0f172a" }}>
                        {s.nombre.replace("Botica Pharma Salud - ", "")}
                      </td>
                      <td style={{ fontWeight: 400, color: s.direccion ? "#475569" : "#94a3b8" }}>
                        {s.direccion || "Sin dirección registrada"}
                      </td>
                      <td style={{ fontWeight: 400, color: s.afiliada ? "#475569" : "#94a3b8" }}>
                        {s.afiliada || "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
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
                      <td className="text-center">
                        <button
                          onClick={() => handleToggleEstado(s)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                        >
                          {s.estado === "activo" ? <ToggleRight size={28} style={{ color: "#10b981" }} /> : <ToggleLeft size={28} style={{ color: "#94a3b8" }} />}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button 
                            onClick={() => handleOpenEdit(s)}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                            title="Editar sucursal"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSucursal(s.id)}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                            title="Eliminar sucursal"
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
        </div>
      )}

      {/* MODAL: Crear / Editar Sucursal */}
      {showModal && (
        <div
          className="admin-modal-overlay-centered"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="admin-modal-card-centered" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px" }}
          >
            <button 
              onClick={() => setShowModal(false)}
              className="admin-modal-close-btn"
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem", fontWeight: 700 }}>
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
              <label className="form-label">Afiliada:</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Red Salud"
                value={afiliada}
                onChange={(e) => setAfiliada(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Estado:</label>
              <CustomSelect
                options={[{value:"activo", label:"Activa"}, {value:"inactivo", label:"Inactiva"}]}
                value={estado}
                onChange={setEstado}
              />
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

      <style>{`
        .admin-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .admin-page-title {
          font-size: 1.65rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
          letter-spacing: -0.03em;
        }

        .admin-page-subtitle {
          font-size: 0.85rem;
          font-weight: 500;
          color: #64748b;
        }

        .admin-header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        /* Filter Card */
        .admin-filter-card {
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.02);
        }

        .admin-search-box-wrap {
          position: relative;
          flex: 1;
          min-width: 320px;
          display: flex;
          align-items: center;
        }

        .admin-search-icon {
          position: absolute;
          left: 14px;
          color: #94a3b8;
          pointer-events: none;
        }

        .admin-search-input {
          width: 100%;
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 500;
          padding: 11px 40px 11px 40px;
          border-radius: 8px;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          background: #f8fafc;
          color: #0f172a;
          transition: all 0.15s ease;
          outline: none;
        }

        .admin-search-input:focus {
          border-color: #e11d48;
          background: #ffffff;
          box-shadow: none;
        }

        .admin-search-shortcut-badge {
          position: absolute;
          right: 14px;
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 5px;
          padding: 2px 6px;
          font-size: 0.65rem;
          font-weight: 800;
          color: #94a3b8;
          pointer-events: none;
          user-select: none;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
          text-transform: uppercase;
        }

        .admin-search-clear-btn {
          position: absolute;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
        }

        .admin-search-clear-btn:hover {
          color: #475569;
        }

        /* Products Table */
        .admin-table-card {
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(15, 23, 42, 0.03);
          overflow: hidden;
        }

        .admin-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .admin-table th {
          background: #f8fafc;
          padding: 16px 20px;
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1.5px solid rgba(15, 23, 42, 0.08);
        }

        .admin-table td {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          transition: background 0.15s ease;
          font-size: 0.85rem;
        }

        .admin-table tbody tr {
          transition: background 0.15s ease;
        }

        .admin-table tbody tr:hover td {
          background: rgba(225, 29, 72, 0.05);
        }

        .admin-table tbody tr:last-child td {
          border-bottom: none;
        }

        .admin-table-empty {
          text-align: center;
          padding: 56px 20px !important;
          color: #94a3b8;
        }

        /* Centered Dialog Modals */
        .admin-modal-overlay-centered {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: admin-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 20px;
          background: rgba(0, 0, 0, 0.4);
        }

        .admin-modal-card-centered {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          padding: 32px 36px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04);
          position: relative;
          display: flex;
          flex-direction: column;
          animation: admin-zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes admin-zoom-in {
          from {
            transform: scale(0.95) translateY(10px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes admin-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .admin-modal-close-btn {
          position: absolute;
          top: 24px;
          right: 24px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 6px;
          border-radius: 50%;
          transition: all 0.15s ease;
        }

        .admin-modal-close-btn:hover {
          background: #f1f5f9;
          color: #475569;
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
      `}</style>
    </div>
  );
}
