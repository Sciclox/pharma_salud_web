"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, Edit2, Trash2, X, Shield, ShieldCheck, ToggleLeft, ToggleRight, CheckCircle2 } from "lucide-react";

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
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Modales - CRUD Usuario
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  
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

  useEffect(() => {
    fetchSucursales();
    fetchUsuarios();
  }, [fetchSucursales, fetchUsuarios]);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (!searchQuery) {
      setUsuariosFiltrados(usuarios);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = usuarios.filter(u => 
        u.nombreVendedor.toLowerCase().includes(query) ||
        u.nombreUsuario.toLowerCase().includes(query) ||
        u.rol.toLowerCase().includes(query)
      );
      setUsuariosFiltrados(filtered);
    }
  }, [searchQuery, usuarios]);

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
    const nuevoEstado = usuario.estado === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (res.ok) {
        fetchUsuarios();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Eliminar usuario
  const handleDeleteUsuario = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta cuenta de usuario de forma física del sistema? Se perderá el acceso.")) {
      return;
    }

    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchUsuarios();
      } else {
        const data = await res.json();
        alert(`Error al eliminar: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
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
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Gestión de Personal</h3>
          <p style={{ fontSize: "0.85rem" }}>Administración de credenciales, roles y sucursales asignadas.</p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <UserPlus size={16} />
          Registrar Colaborador
        </button>
      </div>

      {/* 2. BÚSQUEDA EN TIEMPO REAL */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Buscar colaborador por nombre, usuario o rol..."
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

      {/* 3. TABLA DE USUARIOS */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando lista de colaboradores...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Usuario (Login)</th>
                <th>Rol</th>
                <th>Farmacia Asignada</th>
                <th>Estado</th>
                <th>Bloquear Acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>{u.nombreVendedor}</td>
                    <td style={{ fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{u.nombreUsuario}</td>
                    <td>
                      <span className={`badge ${u.rol === "Administrador" ? "badge-success" : "badge-info"}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {u.rol === "Administrador" ? "🌍 Consolidado Global" : u.sucursal?.nombre}
                    </td>
                    <td>
                      <span className={`badge ${u.estado === "activo" ? "badge-success" : "badge-danger"}`}>
                        {u.estado}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleEstado(u)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: u.estado === "activo" ? "hsl(var(--success))" : "hsl(var(--danger))" }}
                      >
                        {u.estado === "activo" ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button 
                          onClick={() => handleOpenEdit(u)}
                          style={{ background: "none", border: "none", color: "hsl(var(--foreground))", cursor: "pointer" }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUsuario(u.id)}
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

      {/* MODAL: Crear / Editar Usuario */}
      {showModal && (
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
                <select
                  className="input-field"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                >
                  <option value="Vendedor">Vendedor</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Género:</label>
                <select
                  className="input-field"
                  value={genero}
                  onChange={(e) => setGenero(e.target.value)}
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>
            </div>

            {/* Farmacia Asignada (Solo si el rol es Vendedor) */}
            {rol === "Vendedor" && (
              <div className="form-group">
                <label className="form-label">Farmacia Asignada:</label>
                <select
                  className="input-field"
                  value={sucursalId}
                  onChange={(e) => setSucursalId(e.target.value)}
                >
                  <option value="">Seleccione botica...</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
                  ))}
                </select>
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
    </div>
  );
}
