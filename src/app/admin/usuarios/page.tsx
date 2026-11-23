"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, UserPlus, Edit2, Trash2, X, Shield, ShieldCheck, ToggleLeft, ToggleRight, CheckCircle2 } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import { useRouter } from "next/navigation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Usuario {
  id: number;
  nombreUsuario: string;
  nombreVendedor: string;
  rol: string;
  genero: string | null;
  estado: string;
  sucursalId: number | null;
  sucursal: {
    nombre: string;
  } | null;
}

interface Sucursal {
  id: number;
  nombre: string;
}

export default function AdminUsuarios() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("todos");
  const [rolFiltro, setRolFiltro] = useState<string>("todos");

  // Modales - CRUD Usuario
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  useEscapeToClose(showModal, useCallback(() => setShowModal(false), []));
  useBodyScrollLock(showModal);
  
  // Formulario
  const [nombreUsuario, setNombreUsuario] = useState<string>("");
  const [nombreVendedor, setNombreVendedor] = useState<string>("Colaborador");
  const [clave, setClave] = useState<string>("");
  const [rol, setRol] = useState<string>("Vendedor");
  const [sucursalId, setSucursalId] = useState<string>("");
  const [genero, setGenero] = useState<string>("Masculino");
  const [estado, setEstado] = useState<string>("activo");

  // Cargar sucursales para el select del formulario
  const fetchSucursales = useCallback(async () => {
    try {
      const res = await fetch("/api/sucursales");
      if (res.ok) {
        setSucursales(await res.json());
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Cargar lista de usuarios
  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usuarios");
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
        setUsuariosFiltrados(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar sesión del usuario actual
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setCurrentUser(data.user);
        }
      }
    } catch (error) {
      console.error("Error al cargar la sesión:", error);
    }
  }, []);

  useEffect(() => {
    fetchSucursales();
    fetchUsuarios();
    fetchSession();
  }, [fetchSucursales, fetchUsuarios, fetchSession]);

  // Búsqueda en tiempo real y filtros de sucursal/rol
  useEffect(() => {
    let filtered = usuarios;

    // Filtrar por sucursal
    if (sucursalFiltro !== "todos") {
      if (sucursalFiltro === "global") {
        filtered = filtered.filter(u => u.rol === "Administrador");
      } else {
        filtered = filtered.filter(u => u.sucursalId === parseInt(sucursalFiltro));
      }
    }

    // Filtrar por rol
    if (rolFiltro !== "todos") {
      filtered = filtered.filter(u => u.rol === rolFiltro);
    }

    // Filtrar por buscador
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(u => 
        u.nombreVendedor.toLowerCase().includes(query) ||
        u.nombreUsuario.toLowerCase().includes(query) ||
        u.rol.toLowerCase().includes(query)
      );
    }

    setUsuariosFiltrados(filtered);
  }, [searchQuery, sucursalFiltro, rolFiltro, usuarios]);

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
    setEditingUsuario(null);
    setNombreUsuario("");
    setNombreVendedor("");
    setClave("");
    setRol("Vendedor");
    setSucursalId(sucursales.length > 0 ? sucursales[0].id.toString() : "");
    setGenero("Masculino");
    setEstado("activo");
    setShowModal(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setNombreUsuario(usuario.nombreUsuario);
    setNombreVendedor(usuario.nombreVendedor);
    setClave(""); // La clave se deja en blanco, solo se actualiza si escribe una nueva
    setRol(usuario.rol);
    setSucursalId(usuario.sucursalId ? usuario.sucursalId.toString() : "");
    setGenero(usuario.genero || "Masculino");
    setEstado(usuario.estado);
    setShowModal(true);
  };

  // Guardar (Crear o Editar)
  const handleSaveUsuario = async () => {
    if (!nombreUsuario || !nombreVendedor || (!editingUsuario && !clave)) {
      alert("Todos los campos requeridos deben completarse");
      return;
    }

    const payload = {
      nombreUsuario,
      nombreVendedor,
      clave: clave || undefined, // Evita mandar string vacío si edita y no cambia la clave
      rol,
      sucursalId: rol === "Administrador" ? null : parseInt(sucursalId) || null, // Admins son globales, vendedores van con sucursal
      genero,
      estado,
    };

    try {
      let res;
      if (editingUsuario) {
        res = await fetch(`/api/usuarios/${editingUsuario.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        setShowModal(false);
        fetchUsuarios();
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Alternar estado activo/inactivo (Bloqueo rápido de credenciales)
  const handleToggleEstado = async (usuario: Usuario) => {
    if (currentUser && currentUser.id === usuario.id.toString()) {
      alert("No puedes bloquear tu propia cuenta de usuario activa con la que estás sesionado.");
      return;
    }
    const nuevoEstado = usuario.estado === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (res.ok) {
        fetchUsuarios();
        router.refresh();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Eliminar usuario
  const handleDeleteUsuario = async (id: number) => {
    if (currentUser && currentUser.id === id.toString()) {
      alert("No puedes eliminar tu propia cuenta de usuario activa con la que estás sesionado.");
      return;
    }
    const confirmed = await (window as any).showConfirm("¿Está seguro de eliminar esta cuenta de usuario de forma física del sistema? Se perderá el acceso.");
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Usuario eliminado correctamente.");
        fetchUsuarios();
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar usuario");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. CABECERA */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Gestión de Personal</h1>
          <p className="admin-page-subtitle">Administración de credenciales, roles y sucursales asignadas.</p>
        </div>

        <div className="admin-header-actions">
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <UserPlus size={14} strokeWidth={2.5} />
            <span>Registrar Colaborador</span>
          </button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="admin-filter-card" style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "stretch" }}>
        <div className="admin-search-box-wrap" style={{ flex: 1 }}>
          <Search size={18} className="admin-search-icon" strokeWidth={2.2} />
          <input
            ref={searchInputRef}
            type="text"
            className="admin-search-input"
            placeholder="Buscar colaborador por nombre, usuario o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="admin-search-shortcut-badge">F1</div>
          {searchQuery && (
            <button className="admin-search-clear-btn" onClick={() => setSearchQuery("")} style={{ right: "14px" }}>
              <X size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px", padding: "0 4px" }}>
          {/* Filtrar por Sucursal */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Sucursal
            </label>
            <CustomSelect
              options={[
                { value: "todos", label: "Todas las sucursales" },
                { value: "global", label: "Consolidado Global (Admins)" },
                ...sucursales.map(s => ({ value: s.id.toString(), label: s.nombre }))
              ]}
              value={sucursalFiltro}
              onChange={setSucursalFiltro}
              width="240px"
            />
          </div>

          {/* Filtrar por Rol */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
              Rol
            </label>
            <CustomSelect
              options={[
                { value: "todos", label: "Todos los roles" },
                { value: "Administrador", label: "Administrador" },
                { value: "Vendedor", label: "Vendedor" }
              ]}
              value={rolFiltro}
              onChange={setRolFiltro}
              width="180px"
            />
          </div>
        </div>
      </div>

      {/* 3. TABLA DE USUARIOS */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando lista de colaboradores...</p>
        </div>
      ) : (
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Usuario (Login)</th>
                  <th>Rol</th>
                  <th>Farmacia Asignada</th>
                  <th>Estado</th>
                  <th className="text-center">Bloquear Acceso</th>
                  <th className="text-center" style={{ width: "120px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      <div className="admin-empty-state">
                        <Search size={40} className="admin-empty-icon" />
                        <p>No se encontraron colaboradores registrados con los filtros seleccionados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => {
                    const isSelf = currentUser && currentUser.id === u.id.toString();
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 400, color: "#0f172a" }}>{u.nombreVendedor}</td>
                        <td style={{ fontWeight: 500, color: "#64748b" }}>{u.nombreUsuario}</td>
                        <td>
                          <span className={`badge ${u.rol === "Administrador" ? "badge-success" : "badge-info"}`}>
                            {u.rol}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500, color: "#475569" }}>
                          {u.rol === "Administrador" ? "Consolidado Global" : u.sucursal?.nombre}
                        </td>
                        <td>
                          <span className={`badge ${u.estado === "activo" ? "badge-success" : "badge-danger"}`}>
                            {u.estado}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleToggleEstado(u)}
                            disabled={isSelf}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: isSelf ? "not-allowed" : "pointer",
                              color: isSelf ? "#cbd5e1" : (u.estado === "activo" ? "hsl(var(--success))" : "hsl(var(--danger))"),
                              opacity: isSelf ? 0.5 : 1
                            }}
                            title={isSelf ? "No puedes bloquear tu propia cuenta" : "Alternar estado"}
                          >
                            {u.estado === "activo" ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </td>
                        <td className="text-center">
                          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <button 
                              onClick={() => handleOpenEdit(u)}
                              style={{ background: "none", border: "none", color: "hsl(var(--foreground))", cursor: "pointer" }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUsuario(u.id)}
                              disabled={isSelf}
                              style={{
                                background: "none",
                                border: "none",
                                color: isSelf ? "#cbd5e1" : "hsl(var(--danger))",
                                cursor: isSelf ? "not-allowed" : "pointer",
                                opacity: isSelf ? 0.5 : 1
                              }}
                              title={isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar cuenta"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Crear / Editar Usuario */}
      {showModal && (
        <div
          className="overlay-bg-blur"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="card" style={{ width: "450px", position: "relative", overflow: "visible" }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>
              {editingUsuario ? "Editar Perfil de Colaborador" : "Registrar Nuevo Colaborador"}
            </h3>

            <div className="form-group">
              <label className="form-label">Nombre del Colaborador (Nombre de visualización):</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Juan Pérez"
                value={nombreVendedor}
                onChange={(e) => setNombreVendedor(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nombre de Usuario (Login):</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. jperez"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                disabled={!!editingUsuario} // Omitir cambio de nombre usuario en edición por seguridad
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {editingUsuario ? "Nueva Contraseña (Dejar en blanco para conservar):" : "Contraseña de Acceso:"}
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Mínimo 6 caracteres..."
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Rol:</label>
                <CustomSelect
                  options={[{value:"Vendedor", label:"Vendedor"}, {value:"Administrador", label:"Administrador"}]}
                  value={rol}
                  onChange={setRol}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Género:</label>
                <CustomSelect
                  options={[{value:"Masculino", label:"Masculino"}, {value:"Femenino", label:"Femenino"}]}
                  value={genero}
                  onChange={setGenero}
                />
              </div>
            </div>

            {/* Farmacia Asignada (Solo si el rol es Vendedor) */}
            {rol === "Vendedor" && (
              <div className="form-group">
                <label className="form-label">Farmacia Asignada:</label>
                <CustomSelect
                  options={[{value:"", label:"Seleccione botica..."}, ...sucursales.map(s=>({value:s.id.toString(), label:s.nombre}))]}
                  value={sucursalId}
                  onChange={setSucursalId}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveUsuario} style={{ flex: 1 }}>
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

        .admin-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .admin-empty-icon {
          color: #cbd5e1;
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
      `}</style>
    </div>
  );
}
