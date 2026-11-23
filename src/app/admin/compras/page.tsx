"use client";

import { useState, useEffect, useCallback } from "react";
import CustomSelect from "@/components/CustomSelect";
import SucursalSelector from "@/components/SucursalSelector";
import { ClipboardList, Plus, X, Search, Eye, EyeOff, Package } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useSearchParams } from "next/navigation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Producto {
  id: number;
  nombreProducto: string;
}

interface DetalleOrden {
  id: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto: Producto;
}

interface OrdenCompra {
  id: number;
  proveedor: { id: number; nombre: string };
  sucursal: { id: number; nombre: string };
  usuario: { id: number; nombreVendedor: string };
  fecha: string;
  estado: string;
  total: number;
  observaciones: string | null;
  detalles: DetalleOrden[];
}

export default function ComprasPage() {
  const searchParams = useSearchParams();
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null);
  useEscapeToClose(showModal, useCallback(() => setShowModal(false), []));
  useEscapeToClose(!!selectedOrden, useCallback(() => setSelectedOrden(null), []));
  useBodyScrollLock(showModal || !!selectedOrden);

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [detalles, setDetalles] = useState<any[]>([]);
  const [searchProd, setSearchProd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sucursalId = searchParams.get("sucursalId") || "";

  const fetchData = async () => {
    try {
      const res = await fetch("/api/compras/ordenes");
      if (res.ok) setOrdenes(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [pRes, prodRes] = await Promise.all([
        fetch("/api/proveedores"),
        fetch("/api/productos"),
      ]);
      if (pRes.ok) setProveedores(await pRes.json());
      if (prodRes.ok) setProductos(await prodRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    fetchCatalog();
    setProveedorId("");
    setObservaciones("");
    setDetalles([]);
    setSearchProd("");
    setShowModal(true);
  };

  const addDetalle = (prod: any) => {
    const exists = detalles.find((d) => d.productoId === prod.id);
    if (exists) {
      setDetalles(
        detalles.map((d) =>
          d.productoId === prod.id ? { ...d, cantidad: d.cantidad + 1 } : d
        )
      );
    } else {
      setDetalles([
        ...detalles,
        {
          productoId: prod.id,
          nombreProducto: prod.nombreProducto,
          cantidad: 1,
          precioUnitario: 0,
          subtotal: 0,
        },
      ]);
    }
    setSearchProd("");
  };

  const updateDetalle = (index: number, field: string, value: any) => {
    const updated = [...detalles];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "cantidad" || field === "precioUnitario") {
      updated[index].subtotal =
        updated[index].cantidad * updated[index].precioUnitario;
    }
    setDetalles(updated);
  };

  const removeDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (submitting) return;
    if (!proveedorId) return alert("Seleccione un proveedor");
    if (detalles.length === 0) return alert("Agregue al menos un producto");
    setSubmitting(true);

    const payload = {
      proveedorId: parseInt(proveedorId),
      sucursalId: sucursalId || undefined,
      observaciones,
      detalles: detalles.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
      })),
    };

    try {
      const res = await fetch("/api/compras/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitting(false);
        return alert(err.error || "Error al crear orden");
      }
      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnular = async (id: number) => {
    const confirmed = await (window as any).showConfirm("¿Anular esta orden de compra?");
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/compras/ordenes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "anulada" }),
      });
      if (res.ok) {
        alert("Orden de compra anulada correctamente.");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Error al anular la orden");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalOrden = (detalles: any[]) =>
    detalles.reduce((sum, d) => sum + d.cantidad * d.precioUnitario, 0);

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombreProducto.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Órdenes de Compra</h1>
          <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}>
            {ordenes.length} registradas
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <SucursalSelector />
          <button className="btn btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={16} /> Nueva Orden
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>Cargando...</div>
      ) : ordenes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>
          <ClipboardList size={40} style={{ margin: "0 auto 12px", strokeWidth: 1 }} />
          <p>No hay órdenes de compra</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>N° Orden</th>
                <th>Proveedor</th>
                <th>Sucursal</th>
                <th>Creado por</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 400 }}>#{o.id}</td>
                  <td>{o.proveedor?.nombre || "—"}</td>
                  <td>{o.sucursal.nombre}</td>
                  <td style={{ fontSize: "0.82rem", color: "hsl(var(--muted-foreground))" }}>{o.usuario.nombreVendedor}</td>
                  <td>{new Date(o.fecha).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 400 }}>{formatMoney(o.total)}</td>
                  <td>
                    <span className={`badge-premium ${
                      o.estado === "completada" ? "badge-premium-success" :
                      o.estado === "anulada" ? "badge-premium-danger" :
                      "badge-premium-warning"
                    }`}>
                      {o.estado === "pendiente" ? "Pendiente" :
                       o.estado === "completada" ? "Completada" : "Anulada"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-outline" style={{ padding: "6px 10px" }} onClick={() => setSelectedOrden(o)}>
                        <Eye size={14} />
                      </button>
                      {o.estado === "pendiente" && (
                        <button className="btn btn-outline" style={{ padding: "6px 10px", color: "hsl(var(--danger))" }} onClick={() => handleAnular(o.id)}>
                          <X size={14} />
                        </button>
                      )}
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
          <div className="card" style={{ width: "700px", position: "relative", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <button onClick={() => setShowModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "20px" }}>Nueva Orden de Compra</h3>

            <div style={{ display: "flex", gap: "14px", marginBottom: "20px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Proveedor *</label>
                <CustomSelect
                  options={[
                    { value: "", label: "Seleccionar proveedor" },
                    ...proveedores.map((p: any) => ({ value: p.id.toString(), label: p.nombre }))
                  ]}
                  value={proveedorId}
                  onChange={(val) => setProveedorId(val)}
                  placeholder="Seleccionar proveedor"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Observaciones</label>
                <input className="input-field" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas..." style={{ height: "42px" }} />
              </div>
            </div>

            <div style={{ marginBottom: "12px", position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
              <input className="input-field" placeholder="Buscar producto para agregar..." value={searchProd} onChange={(e) => setSearchProd(e.target.value)} style={{ paddingLeft: "36px", height: "40px" }} />
              {searchProd && productosFiltrados.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid hsl(var(--card-border))", borderRadius: "8px", zIndex: 10, maxHeight: "200px", overflowY: "auto", marginTop: "4px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                  {productosFiltrados.slice(0, 10).map((p) => (
                    <div key={p.id} style={{ padding: "10px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", borderBottom: "1px solid hsl(var(--card-border) / 0.5)", display: "flex", alignItems: "center", gap: "10px" }}
                      onClick={() => addDetalle(p)}>
                      <Package size={15} /> {p.nombreProducto}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", marginBottom: "16px" }}>
              {detalles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}>
                  Busque y seleccione productos para agregar a la orden
                </div>
              ) : (
                <table className="table-custom" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ width: "80px" }}>Cantidad</th>
                      <th style={{ width: "100px" }}>Precio Unit.</th>
                      <th style={{ width: "100px" }}>Subtotal</th>
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 400 }}>{d.nombreProducto}</td>
                        <td>
                          <input type="number" min="1" className="input-field" value={d.cantidad}
                            onChange={(e) => updateDetalle(idx, "cantidad", parseInt(e.target.value) || 0)}
                            style={{ width: "70px", height: "34px", padding: "4px 8px" }} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" className="input-field" value={d.precioUnitario}
                            onChange={(e) => updateDetalle(idx, "precioUnitario", parseFloat(e.target.value) || 0)}
                            style={{ width: "90px", height: "34px", padding: "4px 8px" }} />
                        </td>
                        <td style={{ fontWeight: 400 }}>{formatMoney(d.cantidad * d.precioUnitario)}</td>
                        <td>
                          <button style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer" }} onClick={() => removeDetalle(idx)}>
                            <X size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {detalles.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "1.1rem", fontWeight: 700, padding: "12px 0", borderTop: "1px solid hsl(var(--card-border))" }}>
                Total: {formatMoney(totalOrden(detalles))}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={submitting} style={{ flex: 1 }}>{submitting ? "Guardando…" : "Crear Orden de Compra"}</button>
            </div>
          </div>
        </div>
      )}

      {selectedOrden && (
        <div className="overlay-bg-blur" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: "600px", maxHeight: "80vh", overflowY: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedOrden(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "16px" }}>Orden de Compra #{selectedOrden.id}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px", fontSize: "0.88rem" }}>
              <div><strong>Proveedor:</strong> {selectedOrden.proveedor?.nombre || "—"}</div>
              <div><strong>Sucursal:</strong> {selectedOrden.sucursal.nombre}</div>
              <div><strong>Fecha:</strong> {new Date(selectedOrden.fecha).toLocaleDateString()}</div>
              <div><strong>Estado:</strong> <span className={`badge-premium ${
                selectedOrden.estado === "completada" ? "badge-premium-success" :
                selectedOrden.estado === "anulada" ? "badge-premium-danger" : "badge-premium-warning"
              }`}>{selectedOrden.estado}</span></div>
              <div><strong>Creado por:</strong> {selectedOrden.usuario.nombreVendedor}</div>
            </div>
            <div className="table-container">
              <table className="table-custom" style={{ fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>P. Unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrden.detalles.map((d) => (
                    <tr key={d.id}>
                      <td>{d.producto.nombreProducto}</td>
                      <td>{d.cantidad}</td>
                      <td>{formatMoney(d.precioUnitario)}</td>
                      <td style={{ fontWeight: 400 }}>{formatMoney(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", fontSize: "1.15rem", fontWeight: 700 }}>
              Total: {formatMoney(selectedOrden.total)}
            </div>
            {selectedOrden.observaciones && (
              <div style={{ marginTop: "12px", padding: "12px", background: "hsl(var(--muted))", borderRadius: "8px", fontSize: "0.85rem" }}>
                <strong>Observaciones:</strong> {selectedOrden.observaciones}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
