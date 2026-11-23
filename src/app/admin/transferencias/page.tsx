"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Plus, X, Search, Eye, Calendar, Package, Store, ArrowRight, User, FileText, AlertTriangle } from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import SucursalSelector from "@/components/SucursalSelector";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface DetalleTransferencia {
  id: number;
  productoId: number;
  cantidad: number;
  lote: string | null;
  fechaVencimiento: string | null;
  producto: {
    id: number;
    nombreComercial: string | null;
    nombreGenerico: string | null;
    concentracion: string | null;
    presentacion: string | null;
    laboratorio: { nombre: string } | null;
  };
}

interface Transferencia {
  id: number;
  sucursalOrigen: { id: number; nombre: string };
  sucursalDestino: { id: number; nombre: string };
  usuario: { id: number; nombreVendedor: string };
  fecha: string;
  observaciones: string | null;
  detalles: DetalleTransferencia[];
}

export default function TransferenciasPage() {
  const searchParams = useSearchParams();
  const sucursalFiltro = searchParams.get("sucursalId") || "";

  // Listados de transferencias y catálogos
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  
  // Estados de carga e interfaz
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transferencia | null>(null);

  useEscapeToClose(showModal, useCallback(() => setShowModal(false), []));
  useEscapeToClose(!!selectedTransfer, useCallback(() => setSelectedTransfer(null), []));
  useBodyScrollLock(showModal || !!selectedTransfer);

  // Campos para el formulario de Nueva Transferencia
  const [sucursalOrigenId, setSucursalOrigenId] = useState("");
  const [sucursalDestinoId, setSucursalDestinoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [detalles, setDetalles] = useState<any[]>([]);
  const [searchProd, setSearchProd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Lotes disponibles en origen para el producto seleccionado
  const [lotesDisponibles, setLotesDisponibles] = useState<{ [productoId: number]: any[] }>({});

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (sucursalFiltro) params.set("sucursalOrigenId", sucursalFiltro);
      const res = await fetch(`/api/inventarios/transferencias?${params}`);
      if (res.ok) setTransferencias(await res.json());
    } catch (e) {
      console.error("Error al cargar transferencias:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/sucursales"),
        fetch("/api/productos"),
      ]);
      if (sRes.ok) setSucursales(await sRes.json());
      if (pRes.ok) setProductos(await pRes.json());
    } catch (e) {
      console.error("Error al cargar catálogos:", e);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCatalog();
  }, [sucursalFiltro]);

  const openCreateModal = () => {
    setSucursalOrigenId(sucursalFiltro);
    setSucursalDestinoId("");
    setObservaciones("");
    setDetalles([]);
    setSearchProd("");
    setShowModal(true);
  };

  // Cargar lotes disponibles para un producto específico en la sucursal de origen
  const loadLotesForProduct = async (productoId: number, sucursalId: number) => {
    try {
      const res = await fetch(`/api/fecha-vencimiento?sucursalId=${sucursalId}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar lotes para este producto y que tengan cantidad > 0
        const productLotes = data.filter((l: any) => l.productoId === productoId && l.cantidad > 0);
        setLotesDisponibles((prev) => ({
          ...prev,
          [productoId]: productLotes,
        }));
      }
    } catch (e) {
      console.error("Error al cargar lotes del producto:", e);
    }
  };

  const addDetalle = (prod: any) => {
    if (!sucursalOrigenId) {
      alert("Por favor seleccione primero la sucursal de origen");
      return;
    }

    // Obtener stock en sucursal origen
    const invOrigen = prod.inventarios?.find((i: any) => i.sucursalId === parseInt(sucursalOrigenId));
    const stockMax = invOrigen ? invOrigen.cantidadTotal : 0;

    if (stockMax <= 0) {
      alert("Este producto no tiene stock en la sucursal de origen seleccionada");
      return;
    }

    // Comprobar si ya se agregó
    if (detalles.some((d) => d.productoId === prod.id)) {
      alert("Este producto ya está agregado en el traspaso");
      return;
    }

    setDetalles([
      ...detalles,
      {
        productoId: prod.id,
        nombreProducto: prod.nombreProducto,
        cantidad: 1,
        stockMax,
        lote: "",
        fechaVencimiento: "",
      },
    ]);
    
    // Cargar lotes disponibles en origen para este producto
    loadLotesForProduct(prod.id, parseInt(sucursalOrigenId));
    setSearchProd("");
  };

  const updateDetalle = (index: number, field: string, value: any) => {
    const updated = [...detalles];
    updated[index] = { ...updated[index], [field]: value };
    setDetalles(updated);
  };

  // Cuando el usuario selecciona un lote del desplegable
  const handleLoteSelect = (index: number, loteObjString: string) => {
    if (!loteObjString) {
      updateDetalle(index, "lote", "");
      updateDetalle(index, "fechaVencimiento", "");
      return;
    }

    try {
      const loteObj = JSON.parse(loteObjString);
      const updated = [...detalles];
      updated[index].lote = loteObj.lote || "LOTE";
      
      // Formatear fecha yyyy-MM-dd
      if (loteObj.fechaVencimiento) {
        const d = new Date(loteObj.fechaVencimiento);
        const formattedDate = d.toISOString().split("T")[0];
        updated[index].fechaVencimiento = formattedDate;
      } else {
        updated[index].fechaVencimiento = "";
      }
      
      setDetalles(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const removeDetalle = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (submitting) return;
    if (!sucursalOrigenId) return alert("Seleccione la sucursal de origen");
    if (!sucursalDestinoId) return alert("Seleccione la sucursal de destino");
    if (sucursalOrigenId === sucursalDestinoId) return alert("Las sucursales de origen y destino no pueden ser iguales");
    if (detalles.length === 0) return alert("Agregue al menos un producto para transferir");

    // Validar stock antes de enviar
    for (const d of detalles) {
      if (d.cantidad <= 0) return alert(`Ingrese una cantidad válida para ${d.nombreProducto}`);
      if (d.cantidad > d.stockMax) return alert(`La cantidad para ${d.nombreProducto} supera el stock disponible en origen (${d.stockMax})`);
    }

    setSubmitting(true);

    const payload = {
      sucursalOrigenId,
      sucursalDestinoId,
      observaciones,
      detalles: detalles.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        lote: d.lote || null,
        fechaVencimiento: d.fechaVencimiento || null,
      })),
    };

    try {
      const res = await fetch("/api/inventarios/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setSubmitting(false);
        return alert(err.error || "Error al registrar la transferencia");
      }

      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Error de red al registrar la transferencia");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrado de productos disponibles
  const getProductosFiltrados = () => {
    if (!searchProd) return [];
    
    // Filtrar productos que coincidan con la búsqueda
    return productos.filter((p) => {
      const nameMatch = p.nombreProducto.toLowerCase().includes(searchProd.toLowerCase());
      
      // Si hay una sucursal de origen seleccionada, podemos comprobar el stock disponible
      if (sucursalOrigenId) {
        const invOrigen = p.inventarios?.find((i: any) => i.sucursalId === parseInt(sucursalOrigenId));
        const stock = invOrigen ? invOrigen.cantidadTotal : 0;
        return nameMatch && stock > 0;
      }

      return nameMatch;
    });
  };

  const getProductName = (d: DetalleTransferencia) => {
    const p = d.producto;
    if (!p) return "Producto";
    const brand = p.nombreComercial;
    const generic = p.nombreGenerico;
    const conc = p.concentracion ? ` - ${p.concentracion}` : "";
    const pres = p.presentacion ? ` (${p.presentacion})` : "";
    const lab = p.laboratorio?.nombre ? ` [${p.laboratorio.nombre}]` : "";
    
    if (brand && generic) return `${brand} (${generic})${conc}${pres}${lab}`;
    return `${brand || generic || "Producto"}${conc}${pres}${lab}`;
  };

  const productosFiltrados = getProductosFiltrados();

  return (
    <>
      <div>
        {/* Cabecera Principal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "hsl(var(--foreground))" }}>Traspasos de Stock</h1>
            <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}>
              {transferencias.length} traspasos registrados en el historial
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <SucursalSelector />
            <button className="btn btn-primary" onClick={openCreateModal} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Plus size={16} /> Nuevo Traspaso
            </button>
          </div>
        </div>

        {/* Tabla / Lista de Transferencias */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "hsl(var(--muted-foreground))" }}>Cargando traspasos...</div>
        ) : transferencias.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "60px 20px", color: "hsl(var(--muted-foreground))" }}>
            <ArrowLeftRight size={44} style={{ margin: "0 auto 12px", strokeWidth: 1.2, color: "hsl(var(--muted-foreground))" }} />
            <p style={{ fontWeight: 600, fontSize: "0.95rem", margin: 0 }}>No hay transferencias de stock registradas</p>
            <p style={{ fontSize: "0.8rem", margin: "4px 0 0" }}>Crea un traspaso para transferir medicamentos entre sucursales.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>N° Traspaso</th>
                  <th>Fecha</th>
                  <th>Sucursal Origen</th>
                  <th>Sucursal Destino</th>
                  <th>Medicamentos</th>
                  <th>Registrado por</th>
                  <th style={{ width: "80px" }}></th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 400 }}>#{t.id}</td>
                    <td>
                      {new Date(t.fecha).toLocaleDateString()} {new Date(t.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>
                      <span className="badge-premium badge-premium-info" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Store size={12} /> {t.sucursalOrigen.nombre}
                      </span>
                    </td>
                    <td>
                      <span className="badge-premium badge-premium-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Store size={12} /> {t.sucursalDestino.nombre}
                      </span>
                    </td>
                    <td style={{ maxWidth: "240px", whiteSpace: "normal", lineHeight: 1.4 }}>
                      {t.detalles.slice(0, 2).map((d) => d.producto ? (d.producto.nombreComercial || d.producto.nombreGenerico) : "Medicamento").join(", ")}
                      {t.detalles.length > 2 && <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.8rem" }}> +{t.detalles.length - 2} más</span>}
                    </td>
                    <td style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}>{t.usuario.nombreVendedor}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-outline" style={{ padding: "6px 10px" }} onClick={() => setSelectedTransfer(t)} title="Ver detalles">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL 1: Crear Nueva Transferencia */}
        {showModal && (
          <div className="overlay-bg-blur" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="card" style={{ width: "800px", position: "relative", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "28px" }}>
              <button onClick={() => setShowModal(false)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
                <X size={18} />
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ background: "rgba(225, 29, 72, 0.08)", color: "#e11d48", padding: "10px", borderRadius: "10px" }}>
                  <ArrowLeftRight size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Nuevo Traspaso de Medicamentos</h3>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}>Traslada stock físicamente entre inventarios de sucursales</p>
                </div>
              </div>

              {/* Selectores de Sucursales */}
              <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Sucursal Origen *</label>
                  <CustomSelect
                    options={[
                      { value: "", label: "Seleccione origen" },
                      ...sucursales.map((s: any) => ({ value: s.id.toString(), label: s.nombre }))
                    ]}
                    value={sucursalOrigenId}
                    onChange={(val) => {
                      setSucursalOrigenId(val);
                      setDetalles([]); // Limpiar detalles si cambia el origen
                    }}
                    placeholder="Seleccione origen"
                  />
                  <span style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))", marginTop: "4px", display: "block" }}>
                    De donde se restará el stock.
                  </span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "20px" }}>
                  <ArrowRight size={20} style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Sucursal Destino *</label>
                  <CustomSelect
                    options={[
                      { value: "", label: "Seleccione destino" },
                      ...sucursales.map((s: any) => ({ value: s.id.toString(), label: s.nombre }))
                    ]}
                    value={sucursalDestinoId}
                    onChange={(val) => setSucursalDestinoId(val)}
                    placeholder="Seleccione destino"
                  />
                  <span style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))", marginTop: "4px", display: "block" }}>
                    Donde se sumará el stock.
                  </span>
                </div>
              </div>

              {/* Campo Observaciones */}
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label">Notas / Observaciones del Traspaso</label>
                <input
                  className="input-field"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej. Traspaso para cubrir desabastecimiento de paracetamol..."
                  style={{ height: "42px" }}
                />
              </div>

              {/* Buscador de productos */}
              <div style={{ marginBottom: "16px", position: "relative" }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Medicamentos a Traspasar</label>
                <div style={{ position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
                  <input
                    className="input-field"
                    placeholder={sucursalOrigenId ? "Buscar medicamento en la sucursal de origen..." : "Primero elija una sucursal de origen"}
                    value={searchProd}
                    onChange={(e) => setSearchProd(e.target.value)}
                    disabled={!sucursalOrigenId}
                    style={{ paddingLeft: "36px", height: "40px" }}
                  />
                  {searchProd && productosFiltrados.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid hsl(var(--card-border))", borderRadius: "8px", zIndex: 10, maxHeight: "200px", overflowY: "auto", marginTop: "4px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                      {productosFiltrados.slice(0, 10).map((p) => {
                        const inv = p.inventarios?.find((i: any) => i.sucursalId === parseInt(sucursalOrigenId));
                        const stock = inv ? inv.cantidadTotal : 0;
                        return (
                          <div
                            key={p.id}
                            style={{ padding: "10px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", borderBottom: "1px solid hsl(var(--card-border) / 0.5)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                            onClick={() => addDetalle(p)}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <Package size={14} /> {p.nombreProducto}
                            </span>
                            <span className="badge-premium badge-premium-info" style={{ fontSize: "0.75rem" }}>
                              Stock: {stock} und
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla de Detalle temporal */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: "20px", minHeight: "150px", border: "1px solid hsl(var(--card-border))", borderRadius: "8px", background: "hsl(var(--background) / 0.2)" }}>
                {detalles.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "hsl(var(--muted-foreground))", fontSize: "0.85rem", padding: "30px 20px", textAlign: "center" }}>
                    <Package size={24} style={{ marginBottom: "8px", strokeWidth: 1.5 }} />
                    Busque y agregue los medicamentos que desea trasladar
                  </div>
                ) : (
                  <table className="table-custom" style={{ fontSize: "0.82rem", margin: 0 }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th>Producto</th>
                        <th style={{ width: "90px" }}>Stock Disp.</th>
                        <th style={{ width: "95px" }}>Cant. Traspasar</th>
                        <th style={{ width: "160px" }}>Lote en Origen</th>
                        <th style={{ width: "120px" }}>Fecha Venc.</th>
                        <th style={{ width: "40px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalles.map((d, idx) => {
                        const productLotes = lotesDisponibles[d.productoId] || [];
                        return (
                          <tr key={idx}>
                              <td style={{ fontWeight: 400 }}>{d.nombreProducto}</td>
                              <td>
                                <span style={{ fontWeight: 400, color: "hsl(var(--muted-foreground))" }}>
                                {d.stockMax} und
                              </span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                max={d.stockMax}
                                className="input-field"
                                value={d.cantidad}
                                onChange={(e) => updateDetalle(idx, "cantidad", Math.min(d.stockMax, parseInt(e.target.value) || 0))}
                                style={{ width: "75px", height: "30px", padding: "4px 8px", fontWeight: 700 }}
                              />
                            </td>
                            <td>
                              {productLotes.length > 0 ? (
                                <select 
                                  className="input-field" 
                                  style={{ height: "30px", padding: "0 6px", fontSize: "0.8rem", width: "150px" }}
                                  onChange={(e) => handleLoteSelect(idx, e.target.value)}
                                  defaultValue=""
                                >
                                  <option value="">-- Manual / Sin Lote --</option>
                                  {productLotes.map((l: any) => (
                                    <option key={l.id} value={JSON.stringify(l)}>
                                      Lote: {l.lote || "S/L"} ({l.cantidad} und, {new Date(l.fechaVencimiento).toLocaleDateString()})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="input-field"
                                  placeholder="Lote manual"
                                  value={d.lote}
                                  onChange={(e) => updateDetalle(idx, "lote", e.target.value)}
                                  style={{ width: "140px", height: "30px", padding: "4px 6px" }}
                                />
                              )}
                            </td>
                            <td>
                              <input
                                type="date"
                                className="input-field"
                                value={d.fechaVencimiento}
                                onChange={(e) => updateDetalle(idx, "fechaVencimiento", e.target.value)}
                                style={{ width: "110px", height: "30px", padding: "4px 6px" }}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer", display: "inline-flex" }} onClick={() => removeDetalle(idx)}>
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Botones de Guardar */}
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  {submitting ? "Procesando Traspaso..." : "Confirmar Traspaso de Stock"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Ver Detalles de una Transferencia */}
        {selectedTransfer && (
          <div className="overlay-bg-blur" style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setSelectedTransfer(null)}>
            <div className="card" style={{ width: "700px", maxHeight: "80vh", overflowY: "auto", position: "relative", padding: "28px" }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedTransfer(null)} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
                <X size={18} />
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <div style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981", padding: "10px", borderRadius: "10px" }}>
                  <ArrowLeftRight size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Traspaso de Medicamentos #{selectedTransfer.id}</h3>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}>
                    Registrado el {new Date(selectedTransfer.fecha).toLocaleString()}
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px", fontSize: "0.85rem", background: "hsl(var(--muted) / 0.3)", padding: "16px", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Store size={15} style={{ color: "hsl(var(--muted-foreground))" }} />
                  <div>
                    <strong style={{ display: "block", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Sucursal Origen</strong>
                    <span style={{ fontWeight: 700 }}>{selectedTransfer.sucursalOrigen.nombre}</span>
                  </div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Store size={15} style={{ color: "hsl(var(--muted-foreground))" }} />
                  <div>
                    <strong style={{ display: "block", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Sucursal Destino</strong>
                    <span style={{ fontWeight: 700 }}>{selectedTransfer.sucursalDestino.nombre}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", gridColumn: "span 2", borderTop: "1px solid hsl(var(--card-border) / 0.5)", paddingTop: "10px", marginTop: "4px" }}>
                  <User size={15} style={{ color: "hsl(var(--muted-foreground))" }} />
                  <div>
                    <strong style={{ display: "block", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Administrador Responsable</strong>
                    <span style={{ fontWeight: 700 }}>{selectedTransfer.usuario.nombreVendedor}</span>
                  </div>
                </div>
              </div>

              {/* Listado de Productos */}
              <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 700 }}>Medicamentos Transferidos</h4>
              <div className="table-container" style={{ marginBottom: "16px" }}>
                <table className="table-custom" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th style={{ width: "90px" }}>Cantidad</th>
                      <th>Lote</th>
                      <th>Vencimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransfer.detalles.map((d) => (
                      <tr key={d.id}>
                          <td style={{ fontWeight: 400 }}>{getProductName(d)}</td>
                          <td style={{ fontWeight: 400 }}>{d.cantidad} und</td>
                        <td>{d.lote || "—"}</td>
                        <td>{d.fechaVencimiento ? new Date(d.fechaVencimiento).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedTransfer.observaciones && (
                <div style={{ padding: "12px 16px", background: "hsl(var(--muted) / 0.4)", borderRadius: "8px", fontSize: "0.85rem", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <FileText size={16} style={{ color: "hsl(var(--muted-foreground))", marginTop: "2px" }} />
                  <div>
                    <strong style={{ display: "block", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Observaciones</strong>
                    {selectedTransfer.observaciones}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
