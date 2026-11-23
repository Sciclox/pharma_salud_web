"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Edit2, Trash2, X, Building, Store } from "lucide-react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import CustomSelect from "@/components/CustomSelect";

interface Laboratory {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
  fechaCreacion: string;
}

export default function AdminLaboratorios() {
  const [laboratorios, setLaboratorios] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modales/Drawers
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedLaboratory, setSelectedLaboratory] = useState<Laboratory | null>(null);
  useEscapeToClose(showAddModal, useCallback(() => setShowAddModal(false), []));
  useEscapeToClose(!!selectedLaboratory, useCallback(() => setSelectedLaboratory(null), []));
  useBodyScrollLock(showAddModal || !!selectedLaboratory);

  // Formulario de creación
  const [nuevoNombre, setNuevoNombre] = useState<string>( "");
  const [nuevaDescripcion, setNuevaDescripcion] = useState<string>("");

  // Formulario de edición
  const [editNombre, setEditNombre] = useState<string>("");
  const [editDescripcion, setEditDescripcion] = useState<string>("");
  const [editEstado, setEditEstado] = useState<string>("activo");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar laboratorios
  const fetchLaboratorios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/laboratorios");
      if (res.ok) {
        const data = await res.json();
        setLaboratorios(data);
      }
    } catch (error) {
      console.error("Error al cargar laboratorios:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLaboratorios();
  }, [fetchLaboratorios]);

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

  // Registrar nuevo laboratorio
  const handleAddLaboratory = async () => {
    if (!nuevoNombre.trim()) {
      alert("El nombre del laboratorio es requerido");
      return;
    }

    try {
      const res = await fetch("/api/laboratorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevoNombre,
          descripcion: nuevaDescripcion,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNuevoNombre("");
        setNuevaDescripcion("");
        fetchLaboratorios();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al registrar laboratorio:", error);
    }
  };

  // Abrir modal de edición
  const handleOpenEditModal = (lab: Laboratory) => {
    setSelectedLaboratory(lab);
    setEditNombre(lab.nombre);
    setEditDescripcion(lab.descripcion || "");
    setEditEstado(lab.estado);
  };

  // Guardar cambios de edición
  const handleSaveLaboratory = async () => {
    if (!selectedLaboratory) return;
    if (!editNombre.trim()) {
      alert("El nombre del laboratorio es requerido");
      return;
    }

    try {
      const res = await fetch(`/api/laboratorios/${selectedLaboratory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: editNombre,
          descripcion: editDescripcion,
          estado: editEstado,
        }),
      });

      if (res.ok) {
        setSelectedLaboratory(null);
        fetchLaboratorios();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al guardar laboratorio:", error);
    }
  };

  // Eliminar laboratorio
  const handleDeleteLaboratory = async (id: number, nombre: string) => {
    const confirmed = await (window as any).showConfirm(`¿Está seguro de eliminar el laboratorio "${nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/laboratorios/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Laboratorio eliminado correctamente.");
        fetchLaboratorios();
      } else {
        const errData = await res.json();
        alert(errData.error || "Error al eliminar laboratorio");
      }
    } catch (error) {
      console.error("Error al eliminar laboratorio:", error);
    }
  };

  // Filtrar laboratorios
  const filteredLaboratorios = laboratorios.filter(l =>
    l.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.descripcion && l.descripcion.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <div className="admin-labs-root">
        {/* CABECERA: Título y Acciones */}
        <div className="admin-header-row">
          <div>
            <h1 className="admin-page-title">Laboratorios</h1>
            <p className="admin-page-subtitle">Gestiona las firmas y laboratorios farmacéuticos asociados a los productos.</p>
          </div>
          <div className="admin-header-actions">
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} strokeWidth={2.5} />
              <span>Registrar Laboratorio</span>
            </button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="admin-filter-card">
          <div className="admin-search-box-wrap" style={{ flex: 1 }}>
            <Search size={18} className="admin-search-icon" strokeWidth={2.2} />
            <input
              ref={searchInputRef}
              type="text"
              className="admin-search-input"
              placeholder="Buscar por nombre o descripción de laboratorio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="admin-search-shortcut-badge">F1</div>
            {searchQuery && (
              <button className="admin-search-clear-btn" onClick={() => setSearchQuery("")}>
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* TABLA DE LABORATORIOS */}
        {loading ? (
          <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
            <p>Cargando laboratorios...</p>
          </div>
        ) : (
          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre del Laboratorio</th>
                    <th>Descripción</th>
                    <th className="text-center" style={{ width: "120px" }}>Estado</th>
                    <th>Fecha Registro</th>
                    <th className="text-center" style={{ width: "120px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLaboratorios.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-table-empty">
                        <div className="admin-empty-state">
                          <Building size={40} className="admin-empty-icon" />
                          <p>No se encontraron laboratorios registrados.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLaboratorios.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div className="admin-prod-cell">
                            <span className="admin-prod-name">{l.nombre}</span>
                            <span className="admin-prod-meta">ID: #{l.id}</span>
                          </div>
                        </td>
                        <td className="text-muted" style={{ fontSize: "0.85rem", maxWidth: "300px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {l.descripcion || "Sin descripción"}
                        </td>
                        <td className="text-center">
                          <span className={`admin-badge ${l.estado === "activo" ? "badge-success" : "badge-danger"}`}>
                            {l.estado === "activo" ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="text-muted" style={{ fontSize: "0.85rem" }}>
                          {new Date(l.fechaCreacion).toLocaleDateString()}
                        </td>
                        <td className="text-center">
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button
                              className="admin-edit-inv-btn"
                              onClick={() => handleOpenEditModal(l)}
                              style={{ padding: "6px 10px" }}
                            >
                              <Edit2 size={12} strokeWidth={2.5} />
                              <span>Editar</span>
                            </button>
                            <button
                              className="admin-delete-prod-btn"
                              onClick={() => handleDeleteLaboratory(l.id, l.nombre)}
                              title="Eliminar laboratorio"
                            >
                              <Trash2 size={14} strokeWidth={2} />
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

        {/* DRAWER: NUEVO LABORATORIO */}
        {showAddModal && (
          <div className="admin-drawer-overlay overlay-bg-blur">
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowAddModal(false)} className="admin-modal-close-btn">
                <X size={18} strokeWidth={2.5} />
              </button>

              <h3 className="admin-modal-title">Registrar Laboratorio</h3>
              <p className="admin-modal-subtitle">CATÁLOGO MAESTRO</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Laboratorio:</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Genfar, Bagó, Bayer"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción / Nota:</label>
                  <textarea
                    className="input-field"
                    placeholder="Escribe detalles adicionales sobre el laboratorio..."
                    value={nuevaDescripcion}
                    onChange={(e) => setNuevaDescripcion(e.target.value)}
                    style={{ minHeight: "100px", resize: "vertical", fontFamily: "inherit", padding: "10px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "20px" }}>
                <button className="btn btn-outline" onClick={() => setShowAddModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleAddLaboratory} style={{ flex: 1 }}>
                  Registrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DRAWER: EDITAR LABORATORIO */}
        {selectedLaboratory && (
          <div className="admin-drawer-overlay overlay-bg-blur">
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedLaboratory(null)} className="admin-modal-close-btn">
                <X size={18} strokeWidth={2.5} />
              </button>

              <h3 className="admin-modal-title">Editar Laboratorio</h3>
              <p className="admin-modal-subtitle">MODIFICAR DATOS MAESTROS</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Laboratorio:</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción / Nota:</label>
                  <textarea
                    className="input-field"
                    value={editDescripcion}
                    onChange={(e) => setEditDescripcion(e.target.value)}
                    style={{ minHeight: "100px", resize: "vertical", fontFamily: "inherit", padding: "10px" }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estado:</label>
                  <CustomSelect
                    options={[{value:"activo", label:"Activa"}, {value:"inactivo", label:"Inactiva"}]}
                    value={editEstado}
                    onChange={setEditEstado}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "20px" }}>
                <button className="btn btn-outline" onClick={() => setSelectedLaboratory(null)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveLaboratory} style={{ flex: 1 }}>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ESTILOS PREMIUM CONTEXTUALES */}
      <style>{`
        .admin-labs-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
          font-family: var(--font-outfit), system-ui, sans-serif;
        }

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
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.025);
        }

        .admin-search-box-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .admin-search-icon {
          position: absolute;
          left: 16px;
          color: #64748b;
        }

        .admin-search-input {
          width: 100%;
          height: 48px;
          padding: 0 16px 0 48px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.8);
          color: hsl(var(--foreground));
          font-family: var(--font-body), sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          outline: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-search-input:focus {
          background: #ffffff;
          border-color: hsl(var(--primary));
          border-width: 2px;
        }

        .admin-search-shortcut-badge {
          position: absolute;
          right: 16px;
          background: rgba(15, 23, 42, 0.05);
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 6px;
          pointer-events: none;
        }

        .admin-search-clear-btn {
          position: absolute;
          right: 68px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .admin-search-clear-btn:hover {
          color: #475569;
        }

        /* Table Card */
        .admin-table-card {
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.02);
          overflow: hidden;
        }

        .admin-table-scroll {
          overflow-x: auto;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .admin-table th {
          background: #f8fafc;
          padding: 14px 24px;
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1.5px solid rgba(15, 23, 42, 0.06);
        }

        .admin-table td {
          padding: 16px 24px;
          border-bottom: 1.5px solid rgba(15, 23, 42, 0.05);
          font-size: 0.85rem;
          vertical-align: middle;
        }

        .admin-table tr:last-child td {
          border-bottom: none;
        }

        .admin-table tr:hover td {
          background: rgba(225, 29, 72, 0.05);
        }

        .admin-prod-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .admin-prod-name {
          font-weight: 400;
          color: #0f172a;
        }

        .admin-prod-meta {
          font-size: 0.74rem;
          color: #94a3b8;
          font-weight: 400;
        }

        .admin-badge {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 400;
          padding: 4px 10px;
          border-radius: 8px;
          letter-spacing: 0.02em;
        }

        .badge-success {
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        .badge-danger {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .text-muted {
          color: #64748b;
          font-weight: 500;
        }

        .text-center {
          text-align: center;
        }

        /* Buttons & Actions */
        .admin-edit-inv-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 8px;
          color: #475569;
          font-size: 0.78rem;
          font-weight: 750;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .admin-edit-inv-btn:hover {
          color: #e11d48;
          border-color: rgba(225, 29, 72, 0.2);
          background: rgba(225, 29, 72, 0.02);
        }

        .admin-delete-prod-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: transparent;
          border: 1.5px solid transparent;
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .admin-delete-prod-btn:hover {
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.15);
          background: rgba(239, 68, 68, 0.05);
        }

        .admin-table-empty {
          padding: 48px 24px;
        }

        .admin-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #94a3b8;
        }

        .admin-empty-icon {
          opacity: 0.6;
        }

        /* Buttons styles */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 750;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }

        .btn-primary {
          background: #e11d48;
          color: #ffffff;
          border: 1.5px solid #e11d48;
          box-shadow: 0 2px 8px rgba(225, 29, 72, 0.15);
        }

        .btn-primary:hover {
          background: #be123c;
          border-color: #be123c;
          transform: translateY(-1px);
        }

        .btn-outline {
          background: #ffffff;
          color: #475569;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
        }

        .btn-outline:hover {
          background: rgba(15, 23, 42, 0.01);
          border-color: rgba(15, 23, 42, 0.15);
        }

        /* Drawer Slide-over Styles */
        .admin-drawer-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.22s ease-out;
        }

        .admin-drawer-card {
          width: 460px;
          height: 100vh;
          background: #ffffff;
          box-shadow: -10px 0 40px rgba(15, 23, 42, 0.15);
          display: flex;
          flex-direction: column;
          padding: 36px;
          position: relative;
          animation: slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-modal-close-btn {
          position: absolute;
          top: 32px;
          right: 32px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .admin-modal-close-btn:hover {
          color: #475569;
        }

        .admin-modal-title {
          font-size: 1.25rem;
          font-weight: 850;
          color: #0f172a;
          margin-bottom: 2px;
          letter-spacing: -0.03em;
        }

        .admin-modal-subtitle {
          font-size: 0.65rem;
          font-weight: 800;
          color: #e11d48;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 0.78rem;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
