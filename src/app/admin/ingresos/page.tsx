"use client";

import { useState, useEffect, useCallback } from "react";
import CustomSelect from "@/components/CustomSelect";
import SucursalSelector from "@/components/SucursalSelector";
import { PackagePlus, Plus, X, Search, Eye, Calendar, Package } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useSearchParams } from "next/navigation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface DetalleIngreso {
  id: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  fechaVencimiento: string | null;
  lote: string | null;
  producto: { id: number; nombreProducto: string };
}

interface Ingreso {
  id: number;
  sucursal: { id: number; nombre: string };
  usuario: { id: number; nombreVendedor: string };
  ordenCompra: { id: number; proveedor?: { nombre: string } | null } | null;
  fecha: string;
  tipoIngreso: string;
  observaciones: string | null;
  detalles: DetalleIngreso[];
}

export default function IngresosPage() {
  const searchParams = useSearchParams();
  const sucursalFiltro = searchParams.get("sucursalId") || "";

  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIngreso, setSelectedIngreso] = useState<Ingreso | null>(null);
  useEscapeToClose(showModal, useCallback(() => setShowModal(false), []));
  useEscapeToClose(!!selectedIngreso, useCallback(() => setSelectedIngreso(null), []));
  useBodyScrollLock(showModal || !!selectedIngreso);

  const [productos, setProductos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [modalSucursalId, setModalSucursalId] = useState("");
  const [ordenCompraId, setOrdenCompraId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [detalles, setDetalles] = useState<any[]>([]);
  const [searchProd, setSearchProd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (sucursalFiltro) params.set("sucursalId", sucursalFiltro);
      const res = await fetch(`/api/compras/ingresos?${params}`);
      if (res.ok) setIngresos(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/sucursales"),
      ]);
      if (pRes.ok) setProductos(await pRes.json());
      if (sRes.ok) setSucursales(await sRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, [sucursalFiltro]);

  const openCreate = () => {
    fetchCatalog();
    setModalSucursalId(sucursalFiltro);
    setOrdenCompraId("");
    setObservaciones("");
    setDetalles([]);
    setSearchProd("");
    setShowModal(true);
  };

  const addDetalle = (prod: any) => {
    setDetalles([
      ...detalles,
      {
        productoId: prod.id,
        nombreProducto: prod.nombreProducto,
        cantidad: 1,
        precioUnitario: 0,
        fechaVencimiento: "",
        lote: "",
      },
    ]);
    setSearchProd("");
  };

  const updateDetalle = (index: number, field: string, value: any) => {
    const updated = [...detalles];
    updated[index] = { ...updated[index], [field]: value };
    setDetalles(updated);
  };

  const removeDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (submitting) return;
    if (detalles.length === 0) return alert("Agregue al menos un producto");
    setSubmitting(true);

    const payload = {
      sucursalId: modalSucursalId || undefined,
      ordenCompraId: ordenCompraId || undefined,
      observaciones,
      detalles: detalles.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        fechaVencimiento: d.fechaVencimiento || null,
        lote: d.lote || null,
      })),
    };

    try {
      const res = await fetch("/api/compras/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        setSubmitting(false);
        return alert(err.error || "Error al registrar ingreso");
      }
      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const productosFiltrados = productos.filter(
    (p) => p.nombreProducto.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Ingreso de Mercadería</h1>
          <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}>
            {ingresos.length} registros
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <SucursalSelector />
          <button className="btn btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Plus size={16} /> Nuevo Ingreso
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>Cargando...</div>
      ) : ingresos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>
          <PackagePlus size={40} style={{ margin: "0 auto 12px", strokeWidth: 1 }} />
          <p>No hay ingresos registrados</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Tipo</th>
                <th>Productos</th>
                <th>Usuario</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 400 }}>#{i.id}</td>
                  <td>{new Date(i.fecha).toLocaleDateString()} {new Date(i.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{i.sucursal.nombre}</td>
                  <td>
                    <span className={`badge-premium ${i.tipoIngreso === "orden_compra" ? "badge-premium-info" : "badge-premium-warning"}`}>
                      {i.tipoIngreso === "orden_compra" ? "Orden de Compra" : "Directo"}
                    </span>
                  </td>
                  <td style={{ maxWidth: "240px", whiteSpace: "normal", lineHeight: 1.4 }}>
                    {i.detalles.slice(0, 2).map(d => d.producto.nombreProducto).join(", ")}
                    {i.detalles.length > 2 && <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.8rem" }}> +{i.detalles.length - 2} más</span>}
                  </td>
                  <td>{i.usuario.nombreVendedor}</td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: "6px 10px" }} onClick={() => setSelectedIngreso(i)}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="overlay-bg-blur" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: "750px", position: "relative", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <button onClick={() => setShowModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "20px" }}>Registrar Ingreso de Mercadería</h3>

            <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", marginBottom: "16px" }}>
              El ingreso actualizará automáticamente el inventario, creará un registro en el Kardex y la fecha de vencimiento.
            </p>

            <div style={{ display: "flex", gap: "14px", marginBottom: "20px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Sucursal</label>
                <CustomSelect
                  options={[
                    { value: "", label: "Sucursal actual" },
                    ...sucursales.map((s: any) => ({ value: s.id.toString(), label: s.nombre }))
                  ]}
                  value={modalSucursalId}
                  onChange={(val) => setModalSucursalId(val)}
                  placeholder="Seleccione sucursal"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Orden de Compra (opcional)</label>
                <input className="input-field" type="number" placeholder="N° de orden" value={ordenCompraId} onChange={(e) => setOrdenCompraId(e.target.value)} style={{ height: "42px" }} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label">Observaciones</label>
              <input className="input-field" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del ingreso..." style={{ height: "42px" }} />
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
                  Busque y seleccione productos para agregar al ingreso
                </div>
              ) : (
                <table className="table-custom" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ width: "65px" }}>Cant.</th>
                      <th style={{ width: "90px" }}>Costo Unit.</th>
                      <th style={{ width: "110px" }}>Vencimiento</th>
                      <th style={{ width: "70px" }}>Lote</th>
                      <th style={{ width: "35px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 400 }}>{d.nombreProducto}</td>
                        <td>
                          <input type="number" min="1" className="input-field" value={d.cantidad}
                            onChange={(e) => updateDetalle(idx, "cantidad", parseInt(e.target.value) || 0)}
                            style={{ width: "55px", height: "32px", padding: "4px 6px" }} />
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" className="input-field" value={d.precioUnitario}
                            onChange={(e) => updateDetalle(idx, "precioUnitario", parseFloat(e.target.value) || 0)}
                            style={{ width: "80px", height: "32px", padding: "4px 6px" }} />
                        </td>
                        <td>
                          <input type="date" className="input-field" value={d.fechaVencimiento}
                            onChange={(e) => updateDetalle(idx, "fechaVencimiento", e.target.value)}
                            style={{ width: "110px", height: "32px", padding: "4px 6px" }} />
                        </td>
                        <td>
                          <input className="input-field" value={d.lote}
                            onChange={(e) => updateDetalle(idx, "lote", e.target.value)}
                            style={{ width: "65px", height: "32px", padding: "4px 6px" }} />
                        </td>
                        <td>
                          <button style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer" }} onClick={() => removeDetalle(idx)}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={submitting} style={{ flex: 1 }}>{submitting ? "Guardando…" : "Registrar Ingreso"}</button>
            </div>
          </div>
        </div>
      )}

      {selectedIngreso && (
        <div className="overlay-bg-blur" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: "650px", maxHeight: "80vh", overflowY: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedIngreso(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
            <h3 style={{ marginBottom: "16px" }}>Ingreso de Mercadería #{selectedIngreso.id}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px", fontSize: "0.88rem" }}>
              <div><strong>Sucursal:</strong> {selectedIngreso.sucursal.nombre}</div>
              <div><strong>Fecha:</strong> {new Date(selectedIngreso.fecha).toLocaleString()}</div>
              <div><strong>Usuario:</strong> {selectedIngreso.usuario.nombreVendedor}</div>
              <div><strong>Tipo:</strong> <span className={`badge-premium ${selectedIngreso.tipoIngreso === "orden_compra" ? "badge-premium-info" : "badge-premium-warning"}`}>
                {selectedIngreso.tipoIngreso === "orden_compra" ? "Orden de Compra" : "Directo"}
              </span></div>
              {selectedIngreso.ordenCompra?.proveedor?.nombre && (
                <div><strong>Proveedor:</strong> {selectedIngreso.ordenCompra.proveedor.nombre}</div>
              )}
            </div>
            <div className="table-container">
              <table className="table-custom" style={{ fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Costo Unit.</th>
                    <th>Total</th>
                    <th>Vencimiento</th>
                    <th>Lote</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedIngreso.detalles.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 400 }}>{d.producto.nombreProducto}</td>
                      <td>{d.cantidad}</td>
                      <td>{formatMoney(d.precioUnitario)}</td>
                      <td style={{ fontWeight: 400 }}>{formatMoney(d.cantidad * d.precioUnitario)}</td>
                      <td>{d.fechaVencimiento ? new Date(d.fechaVencimiento).toLocaleDateString() : "—"}</td>
                      <td>{d.lote || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedIngreso.observaciones && (
              <div style={{ marginTop: "12px", padding: "12px", background: "hsl(var(--muted))", borderRadius: "8px", fontSize: "0.85rem" }}>
                <strong>Observaciones:</strong> {selectedIngreso.observaciones}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
