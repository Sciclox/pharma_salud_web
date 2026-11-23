"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Truck, Plus, Pencil, Trash2, X, Search, Phone, Mail, MapPin, User as UserIcon, Building } from "lucide-react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Proveedor {
  id: number;
  nombre: string;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  estado: string;
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Proveedor | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEscapeToClose(showModal, useCallback(() => setShowModal(false), []));
  useBodyScrollLock(showModal);

  const [form, setForm] = useState({
    nombre: "",
    ruc: "",
    direccion: "",
    telefono: "",
    email: "",
    contacto: "",
  });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/proveedores");
      if (res.ok) setProveedores(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const openCreate = () => {
    setEditItem(null);
    setForm({ nombre: "", ruc: "", direccion: "", telefono: "", email: "", contacto: "" });
    setShowModal(true);
  };

  const openEdit = (p: Proveedor) => {
    setEditItem(p);
    setForm({
      nombre: p.nombre,
      ruc: p.ruc || "",
      direccion: p.direccion || "",
      telefono: p.telefono || "",
      email: p.email || "",
      contacto: p.contacto || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return alert("El nombre es obligatorio");

    try {
      const url = editItem ? `/api/proveedores/${editItem.id}` : "/api/proveedores";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        return alert(err.error || "Error al guardar");
      }

      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await (window as any).showConfirm("¿Eliminar este proveedor?");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/proveedores/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Proveedor eliminado correctamente.");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar proveedor");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtrados = proveedores.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.ruc && p.ruc.includes(search)) ||
      (p.contacto && p.contacto.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Proveedores</h1>
          <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}>
            {proveedores.length} registrados
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      <div style={{ position: "relative", marginBottom: "20px", maxWidth: "400px" }}>
        <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
        <input
          ref={searchInputRef}
          className="input-field"
          placeholder="Buscar por nombre, RUC o contacto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: "38px", paddingRight: "60px", height: "42px" }}
        />
        <div 
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(15, 23, 42, 0.05)",
            color: "#64748b",
            fontSize: "0.68rem",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "6px",
            pointerEvents: "none",
            userSelect: "none"
          }}
        >
          F1
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>
          <Truck size={40} style={{ margin: "0 auto 12px", strokeWidth: 1 }} />
          <p>No se encontraron proveedores</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>RUC</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 400 }}>{p.nombre}</td>
                  <td>{p.ruc || "—"}</td>
                  <td>
                    {p.contacto ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <UserIcon size={13} /> {p.contacto}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    {p.telefono ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={13} /> {p.telefono}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    {p.email ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Mail size={13} /> {p.email}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    <span className={`badge-premium ${p.estado === "activo" ? "badge-premium-success" : "badge-premium-danger"}`}>
                      {p.estado === "activo" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-outline" style={{ padding: "6px 10px" }} onClick={() => openEdit(p)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-outline" style={{ padding: "6px 10px", color: "hsl(var(--danger))" }} onClick={() => handleDelete(p.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="overlay-bg-blur" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: "520px", position: "relative" }}>
            <button onClick={() => setShowModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "20px" }}>{editItem ? "Editar Proveedor" : "Nuevo Proveedor"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del proveedor" />
              </div>
              <div className="form-group">
                <label className="form-label">RUC</label>
                <input className="input-field" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} placeholder="20XXXXXXXXX" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="input-field" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+51 999 999 999" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="proveedor@email.com" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Persona de Contacto</label>
                <input className="input-field" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Nombre del contacto" />
              </div>
              <div className="form-group">
                <label className="form-label">Dirección</label>
                <input className="input-field" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección del proveedor" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>{editItem ? "Guardar Cambios" : "Crear Proveedor"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
