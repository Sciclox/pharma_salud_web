"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, ShoppingCart, Receipt, DollarSign,
  Plus, Minus, Trash2, CheckCircle2, X,
  Package, AlertTriangle, Pill, Banknote, Clock,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatMoney } from "@/lib/format";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import { useLocalState } from "@/hooks/useLocalState";

interface InventarioItem {
  id: number;
  productoId: number;
  sucursalId: number;
  cantidadTotal: number;
  precioCaja: number;
  precioUnidad: number;
  costoCaja: number;
  costoUnidad: number;
  stockMinimo: number;
  producto: {
    nombreProducto: string;
    tipoProducto: string | null;
    cantidadPresentacion: number | null;
    cantidadPresentacionBlister: number | null;
  };
}

export default function VendedorPOS() {
  const {
    items: cartItems,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    checkout,
    getSubtotal,
    loading: cartLoading,
  } = useCart();

  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<InventarioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingInventario, setLoadingInventario] = useState<boolean>(true);

  const [selectedProduct, setSelectedProduct] = useState<InventarioItem | null>(null);
  const [tipoVenta, setTipoVenta] = useState<string>("Venta por unidad");
  const [cantidadAñadir, setCantidadAñadir] = useState<number>(1);

  const [pagoCon, setPagoCon] = useState<string>("");
  const [vuelto, setVuelto] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [ultimoCobro, setUltimoCobro] = useState<any>(null);

  const [showArqueoModal, setShowArqueoModal] = useState<boolean>(false);
  const [montoArqueo, setMontoArqueo] = useState<string>("");
  const [notaArqueo, setNotaArqueo] = useState<string>("");

  const [showTicketsModal, setShowTicketsModal] = useState<boolean>(false);
  const [ticketsDia, setTicketsDia] = useState<any[]>([]);

  // Panel Ventas del Día
  const [ventasDia, setVentasDia] = useState<any[]>([]);
  const [loadingVentas, setLoadingVentas] = useState<boolean>(true);
  const [showVentas, setShowVentas] = useLocalState("show-ventas-dia", true);
  const [showCart, setShowCart] = useLocalState("show-cart", true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchInventario = useCallback(async () => {
    setLoadingInventario(true);
    try {
      const res = await fetch("/api/inventarios");
      if (res.ok) {
        const data = await res.json();
        setInventario(data);
        setProductosFiltrados(data);
      }
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    } finally {
      setLoadingInventario(false);
    }
  }, []);

  const fetchVentasDia = useCallback(async () => {
    setLoadingVentas(true);
    try {
      // Usar fecha LOCAL (no UTC) para evitar desfase de zona horaria (Peru = UTC-5)
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/ventas?fechaInicio=${hoy}&fechaFin=${hoy}`);
      if (res.ok) {
        const data = await res.json();
        setVentasDia(data);
        setTicketsDia(data);
      }
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    } finally {
      setLoadingVentas(false);
    }
  }, []);


  useEffect(() => {
    fetchInventario();
    fetchVentasDia();
    searchInputRef.current?.focus();
  }, [fetchInventario, fetchVentasDia]);

  // Tiempo real con Supabase Realtime para actualizar existencias, precios y ventas al instante
  useEffect(() => {
    let activeChannel: any = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const setupRealtime = async () => {
      try {
        const res = await fetch("/api/config/supabase");
        if (!res.ok) {
          throw new Error("Failed to fetch Supabase config");
        }

        const { supabaseUrl, supabaseAnonKey } = await res.json();
        if (!supabaseUrl || !supabaseAnonKey) {
          console.warn("Supabase credentials not configured. Falling back to 10s polling.");
          startFallbackPolling();
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const channel = supabase
          .channel("realtime-vendedor")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "inventario_sucursal" },
            (payload) => {
              console.log("Cambio en inventario detectado en tiempo real:", payload);
              fetchInventario();
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "registro_de_ventas" },
            (payload) => {
              console.log("Cambio en ventas detectado en tiempo real:", payload);
              fetchVentasDia();
            }
          )
          .subscribe((status) => {
            console.log("Estado de suscripción Supabase Realtime:", status);
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              console.warn("Realtime subscription failed. Falling back to 10s polling.");
              startFallbackPolling();
            }
          });

        activeChannel = channel;
      } catch (error) {
        console.error("Error setting up Supabase Realtime, using fallback polling:", error);
        startFallbackPolling();
      }
    };

    const startFallbackPolling = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        fetchInventario();
        fetchVentasDia();
      }, 10000);
    };

    setupRealtime();

    return () => {
      if (activeChannel) {
        activeChannel.unsubscribe();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [fetchInventario, fetchVentasDia]);

  useEffect(() => {
    const handleOpenTickets = () => {
      fetchVentasDia();
      setShowTicketsModal(true);
    };
    const handleOpenArqueo = () => {
      setShowArqueoModal(true);
    };

    window.addEventListener("pos-open-tickets", handleOpenTickets);
    window.addEventListener("pos-open-arqueo", handleOpenArqueo);

    return () => {
      window.removeEventListener("pos-open-tickets", handleOpenTickets);
      window.removeEventListener("pos-open-arqueo", handleOpenArqueo);
    };
  }, [fetchVentasDia]);

  useEffect(() => {
    if (!searchQuery) {
      setProductosFiltrados(inventario);
    } else {
      const q = searchQuery.toLowerCase();
      setProductosFiltrados(
        inventario.filter(
          (item) =>
            item.producto.nombreProducto.toLowerCase().includes(q) ||
            (item.producto.tipoProducto &&
              item.producto.tipoProducto.toLowerCase().includes(q))
        )
      );
    }
  }, [searchQuery, inventario]);



  const subtotal = getSubtotal();
  const totalVendioHoy = ventasDia.reduce((acc, t) => acc + (t.total || 0), 0);
  useEffect(() => {
    const pago = parseFloat(pagoCon) || 0;
    setVuelto(pago >= subtotal && subtotal > 0 ? pago - subtotal : 0);
  }, [pagoCon, subtotal]);

  const handleOpenAddModal = (item: InventarioItem) => {
    setSelectedProduct(item);
    setTipoVenta("Venta por unidad");
    setCantidadAñadir(1);
  };

  const handleConfirmAdd = async () => {
    if (!selectedProduct) return;
    let precio = selectedProduct.precioUnidad;
    if (tipoVenta === "Venta por caja") {
      precio = selectedProduct.precioCaja;
    } else if (tipoVenta === "Venta por blíster") {
      const fb = selectedProduct.producto.cantidadPresentacionBlister || 10;
      const fc = selectedProduct.producto.cantidadPresentacion || 100;
      precio = (selectedProduct.precioCaja / fc) * fb;
    }
    const success = await addToCart(selectedProduct.productoId, cantidadAñadir, precio, tipoVenta);
    if (success) {
      setSelectedProduct(null);
      setSearchQuery("");
      searchInputRef.current?.focus();
    }
  };

  const handleCobrar = async () => {
    if (subtotal <= 0) return;
    const pago = parseFloat(pagoCon) || 0;
    if (pago < subtotal) { alert("El monto de pago es insuficiente"); return; }
    const res = await checkout(pago, vuelto);
    if (res.success) {
      setUltimoCobro(res);
      setShowSuccessModal(true);
      setPagoCon("");
      setVuelto(0);
      fetchInventario();
      fetchVentasDia();
    } else {
      alert(`Error al procesar cobro: ${res.error}`);
    }
  };

  const handleRegistrarArqueo = async () => {
    const monto = parseFloat(montoArqueo);
    if (isNaN(monto)) { alert("Ingrese un monto válido"); return; }
    try {
      const res = await fetch("/api/sobrante-caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, nota: notaArqueo }),
      });
      if (res.ok) {
        alert("Arqueo registrado correctamente");
        setShowArqueoModal(false);
        setMontoArqueo("");
        setNotaArqueo("");
      } else {
        alert("Error al registrar arqueo");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const generateTicketPDF = (venta: any) => {
    const doc = new jsPDF({ unit: "mm", format: [80, 150] });
    doc.setFont("courier");
    doc.setFontSize(9);
    doc.text("BOTICA PHARMA SALUD", 40, 10, { align: "center" });
    doc.setFontSize(8);
    doc.text("RUC: 10427847118", 40, 14, { align: "center" });
    doc.text("Av. Larco 456, Trujillo", 40, 18, { align: "center" });
    doc.text("--------------------------------", 40, 22, { align: "center" });
    doc.text(`TICKET N°: 0000${venta.ventaId || venta.id}`, 5, 27);
    const fecha = venta.fecha ? new Date(venta.fecha) : new Date();
    doc.text(`FECHA: ${fecha.toLocaleString()}`, 5, 31);
    doc.text("--------------------------------", 40, 36, { align: "center" });
    doc.text("CANT  DESCRIPCIÓN      IMPORTE", 5, 41);
    doc.text("--------------------------------", 40, 45, { align: "center" });
    let y = 50;

    const items = venta.detalles || venta.items || (cartItems.length > 0 ? cartItems : null);
    if (items && items.length > 0) {
      items.forEach((item: any) => {
        const nombreProd = item.nombreProducto || item.producto?.nombreProducto || "Producto";
        const desc = nombreProd.substring(0, 16);
        const sub = item.cantidad * (item.precioVenta || item.precioVentaUnitario || 0);
        doc.text(`${item.cantidad.toString().padEnd(4)}  ${desc.padEnd(16)} S/${sub.toFixed(2)}`, 5, y);
        y += 5;
      });
    } else {
      doc.text("Productos procesados en venta.", 5, y);
      y += 5;
    }
    doc.text("--------------------------------", 40, y + 2, { align: "center" });
    y += 7;
    doc.text(`TOTAL:        S/${(venta.total || 0).toFixed(2)}`, 45, y);
    doc.text(`RECIBIDO:     S/${(venta.pagoCon || 0).toFixed(2)}`, 45, y + 4);
    doc.text(`CAMBIO:       S/${(venta.vuelto || 0).toFixed(2)}`, 45, y + 8);
    y += 15;
    doc.text("GRACIAS POR SU PREFERENCIA", 40, y, { align: "center" });
    doc.text("VUELVA PRONTO", 40, y + 4, { align: "center" });
    window.open(doc.output("bloburl"), "_blank");
  };

  // — precio mostrado en el modal —
  const getPrecioModal = () => {
    if (!selectedProduct) return 0;
    if (tipoVenta === "Venta por caja") return selectedProduct.precioCaja;
    if (tipoVenta === "Venta por blíster") {
      const fb = selectedProduct.producto.cantidadPresentacionBlister || 10;
      const fc = selectedProduct.producto.cantidadPresentacion || 100;
      return (selectedProduct.precioCaja / fc) * fb;
    }
    return selectedProduct.precioUnidad;
  };

  return (
    <>
      {/* ─────────────────────────────── LAYOUT POS ─────────────────────────────── */}
      <div className="pos-root">

        {/* ══ PANEL IZQUIERDO: Catálogo ══ */}
        <div className="pos-catalog">

          {/* Barra de búsqueda + acciones */}
          <div className="pos-topbar">
            <div className="pos-search-wrap">
              <Search size={17} className="pos-search-icon" strokeWidth={1.75} />
              <input
                ref={searchInputRef}
                type="text"
                className="pos-search"
                placeholder="Buscar medicamento por nombre o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="pos-search-actions">
                {searchQuery && (
                  <button className="pos-search-clear" onClick={() => setSearchQuery("")}>
                    <X size={15} strokeWidth={2} />
                  </button>
                )}
                <div className="pos-search-badge">
                  {loadingInventario ? "CARGANDO..." : `${productosFiltrados.length} RESULTADOS`}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de productos con cabecera integrada */}
          <div className="pos-table-wrap">
            {loadingInventario ? (
              <div className="pos-skeleton-list">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="pos-skeleton-row" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            ) : (
              <table className="pos-table" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ width: "35%" }}>Medicamento</th>
                    <th style={{ width: "15%" }}>Categoría</th>
                    <th style={{ width: "25%", textAlign: "center" }} colSpan={2}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                        <span>STOCK</span>
                        <span style={{ display: "flex", gap: "16px", fontSize: "inherit", fontWeight: "inherit", opacity: 0.55 }}>
                          <span>CAJA</span>
                          <span>UNIDAD</span>
                        </span>
                      </div>
                    </th>
                    <th style={{ width: "25%", textAlign: "center" }} colSpan={2}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                        <span>PRECIO</span>
                        <span style={{ display: "flex", gap: "16px", fontSize: "inherit", fontWeight: "inherit", opacity: 0.55 }}>
                          <span>CAJA</span>
                          <span>UNIDAD</span>
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="pos-empty">
                          <Package size={36} strokeWidth={1} />
                          <p>No se encontraron medicamentos</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    productosFiltrados.map((item) => {
                      const fc = item.producto.cantidadPresentacion || 1;
                      const cajas = Math.floor(item.cantidadTotal / fc);
                      const unds = item.cantidadTotal % fc;
                      const bajo = item.cantidadTotal <= item.stockMinimo;
                      const sinStock = item.cantidadTotal <= 0;
                      const esUnidad = item.producto.tipoProducto?.toLowerCase() === "unidad";

                      return (
                        <tr 
                          key={item.id} 
                          className={sinStock ? "pos-row-disabled" : ""}
                          onClick={() => !sinStock && handleOpenAddModal(item)}
                        >
                          <td style={{ width: "35%" }}>
                            <div className="pos-td-name-inner">
                              {item.producto.nombreProducto}
                            </div>
                          </td>
                          <td style={{ width: "15%" }}>
                            {item.producto.tipoProducto || "General"}
                          </td>
                          <td style={{ width: "12%", textAlign: "center" }}>
                            {esUnidad ? "--" : (sinStock ? 0 : cajas)}
                          </td>
                          <td style={{ width: "13%", textAlign: "center" }}>
                            {sinStock ? 0 : unds}
                          </td>
                          <td style={{ width: "12%", textAlign: "center" }} className="pos-td-price">
                            {esUnidad ? "--" : formatMoney(item.precioCaja)}
                          </td>
                          <td style={{ width: "13%", textAlign: "center" }} className="pos-td-price">
                            {formatMoney(item.precioUnidad)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ══ PANEL CENTRAL: Ventas del Día ══ */}
        {showVentas && (
          <aside className="pos-ventas-dia">
            {/* Encabezado total similar al carrito */}
            <div className="pos-ventas-hero">
              <div className="pos-ventas-hero-label">
                <Clock size={16} strokeWidth={1.75} style={{ color: "#10b981" }} />
                Ventas del Día
                <span className="pos-ventas-badge">{ventasDia.length}</span>
              </div>
              <p className="pos-ventas-hero-total">{formatMoney(totalVendioHoy)}</p>
              <p className="pos-ventas-hero-sub">TOTAL RECAUDADO HOY</p>
            </div>

            {/* Lista de Ventas */}
            <div className="pos-ventas-items">
              {loadingVentas ? (
                <div className="pos-ventas-loading">
                  <span className="pos-spinner" style={{ borderColor: "rgba(16,185,129,.3)", borderTopColor: "#10b981" }} />
                  <p>Cargando ventas...</p>
                </div>
              ) : ventasDia.length === 0 ? (
                <div className="pos-ventas-empty">
                  <Clock size={40} strokeWidth={1} />
                  <p>Sin ventas hoy</p>
                  <small>Las ventas finalizadas aparecerán aquí</small>
                </div>
              ) : (
                ventasDia.map((venta) => (
                  <div key={venta.id} className="pos-venta-card">
                    <div className="pos-venta-card-header">
                      <span className="pos-venta-ticket">Ticket #{venta.id}</span>
                      <span className="pos-venta-time">
                        {new Date(venta.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    {/* Detalles de productos en la venta */}
                    <div className="pos-venta-details">
                      {venta.detalles && venta.detalles.map((det: any, idx: number) => (
                        <div key={idx} className="pos-venta-det-row">
                          <span className="pos-venta-det-qty">{det.cantidad}x</span>
                          <span className="pos-venta-det-name" title={det.nombreProducto}>{det.nombreProducto}</span>
                          <span className="pos-venta-det-type">({det.tipoVenta.replace("Venta por ", "")})</span>
                        </div>
                      ))}
                    </div>

                    <div className="pos-venta-card-footer">
                      <div className="pos-venta-total-info">
                        <span className="pos-venta-total-label">TOTAL</span>
                        <span className="pos-venta-total-val">{formatMoney(venta.total)}</span>
                      </div>
                      
                      <button 
                        className="pos-venta-reprint-btn"
                        onClick={() => generateTicketPDF(venta)}
                        title="Reimprimir ticket"
                      >
                        <Receipt size={12} strokeWidth={2} />
                        Ticket
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* ══ PANEL DERECHO: Carrito ══ */}
        {/* ══ PANEL DERECHO: Carrito ══ */}
        {showCart && (
          <aside className="pos-cart">

            {/* Encabezado total estilo Flutter */}
            <div className="pos-cart-hero">
              <div className="pos-cart-hero-label">
                <ShoppingCart size={16} strokeWidth={1.75} />
                Tu Selección
                <span className="pos-cart-badge">{cartItems.length}</span>
              </div>
              <p className="pos-cart-hero-total">{formatMoney(subtotal)}</p>
              <p className="pos-cart-hero-sub">TOTAL A LIQUIDAR</p>
            </div>

            {/* Ítems */}
            <div className="pos-cart-items">
              {cartItems.length === 0 ? (
                <div className="pos-cart-empty">
                  <ShoppingCart size={40} strokeWidth={1} />
                  <p>El carrito está vacío</p>
                  <small>Busca y agrega productos al catálogo</small>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="pos-cart-item">
                    <div className="pos-cart-item-info">
                      <span className="pos-cart-item-name">{item.producto.nombreProducto}</span>
                      <div className="pos-cart-item-tags">
                        <span className="pos-cart-tag">{item.tipoVenta.replace("Venta por ", "").toUpperCase()}</span>
                        <span className="pos-cart-item-qty">CANT: {item.cantidad}</span>
                      </div>
                      <span className="pos-cart-item-subtotal">{formatMoney(item.cantidad * item.precioVenta)}</span>
                    </div>
                    <div className="pos-cart-item-actions">
                      <div className="pos-qty-ctrl">
                        <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.cantidad - 1)}>
                          <Minus size={10} strokeWidth={2.5} />
                        </button>
                        <span className="pos-qty-val">{item.cantidad}</span>
                        <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.cantidad + 1)}>
                          <Plus size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                      <button className="pos-remove-btn" onClick={() => removeItem(item.id)}>
                        <Trash2 size={15} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculadora de vuelto estilo Flutter */}
            <div className="pos-cobro">
              <div className="pos-calc-box">
                <div className="pos-calc-label">
                  <Banknote size={13} strokeWidth={1.75} />
                  CALCULADORA DE VUELTO
                </div>
                <div className="pos-calc-row">
                  <div className="pos-calc-input-wrap">
                    <span className="pos-calc-prefix">S/</span>
                    <input
                      type="number"
                      placeholder="Paga con..."
                      value={pagoCon}
                      onChange={(e) => setPagoCon(e.target.value)}
                      disabled={subtotal <= 0}
                      className="pos-cobro-input"
                    />
                  </div>
                  <div className="pos-calc-divider" />
                  <div className="pos-calc-vuelto">
                    <span className={vuelto > 0 ? "pos-vuelto-label-green" : "pos-vuelto-label-gray"}>VUELTO</span>
                    <span className={`pos-vuelto-amount ${vuelto > 0 ? "pos-vuelto-green" : "pos-vuelto-gray"}`}>
                      {formatMoney(vuelto)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="pos-cobrar-btn"
                onClick={handleCobrar}
                disabled={subtotal <= 0 || !pagoCon || parseFloat(pagoCon) < subtotal || cartLoading}
              >
                {cartLoading ? (
                  <><span className="pos-spinner" /> Procesando…</>
                ) : (
                  <>Finalizar Operación</>
                )}
              </button>

              {cartItems.length > 0 && (
                <button className="pos-cancel-btn" onClick={clearCart}>
                  Cancelar venta actual
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─────────────────────────────── MODALES ─────────────────────────────── */}

      {/* Modal 1: Agregar producto */}
      {selectedProduct && (
        <div className="pos-modal-bg" onClick={() => setSelectedProduct(null)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <div>
                <span className="pos-modal-kicker">{selectedProduct.producto.tipoProducto || "Medicamento"}</span>
                <h3 className="pos-modal-title">{selectedProduct.producto.nombreProducto}</h3>
              </div>
              <button className="pos-modal-close" onClick={() => setSelectedProduct(null)}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="pos-modal-field">
              <label>Tipo de venta</label>
              <div className="pos-modal-segments">
                <button
                  type="button"
                  className={`pos-modal-segment ${tipoVenta === "Venta por unidad" ? "active" : ""}`}
                  onClick={() => setTipoVenta("Venta por unidad")}
                >
                  <span className="segment-label">Unidad</span>
                  <span className="segment-price">{formatMoney(selectedProduct.precioUnidad)}</span>
                </button>
                {selectedProduct.precioCaja > 0 && selectedProduct.producto.tipoProducto?.toLowerCase() !== "unidad" && (
                  <button
                    type="button"
                    className={`pos-modal-segment ${tipoVenta === "Venta por caja" ? "active" : ""}`}
                    onClick={() => setTipoVenta("Venta por caja")}
                  >
                    <span className="segment-label">Caja</span>
                    <span className="segment-price">{formatMoney(selectedProduct.precioCaja)}</span>
                  </button>
                )}
                {selectedProduct.producto.cantidadPresentacionBlister && selectedProduct.producto.tipoProducto?.toLowerCase() !== "unidad" && (
                  <button
                    type="button"
                    className={`pos-modal-segment ${tipoVenta === "Venta por blíster" ? "active" : ""}`}
                    onClick={() => setTipoVenta("Venta por blíster")}
                  >
                    <span className="segment-label">Blíster</span>
                    <span className="segment-price">
                      {formatMoney((selectedProduct.precioCaja / (selectedProduct.producto.cantidadPresentacion || 100)) * (selectedProduct.producto.cantidadPresentacionBlister || 10))}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="pos-modal-footer-summary">
              <div className="pos-modal-field" style={{ marginBottom: 0 }}>
                <label>Cantidad</label>
                <div className="pos-modal-qty">
                  <button type="button" onClick={() => setCantidadAñadir(Math.max(1, cantidadAñadir - 1))}>
                    <Minus size={13} strokeWidth={2.5} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={cantidadAñadir}
                    onChange={(e) => setCantidadAñadir(parseInt(e.target.value) || 1)}
                  />
                  <button type="button" onClick={() => setCantidadAñadir(cantidadAñadir + 1)}>
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="pos-modal-total-display">
                <span className="total-label">Subtotal estimado</span>
                <strong className="total-val">{formatMoney(getPrecioModal() * cantidadAñadir)}</strong>
              </div>
            </div>

            <div className="pos-modal-actions">
              <button className="pos-modal-cancel" onClick={() => setSelectedProduct(null)}>Cancelar</button>
              <button className="pos-modal-confirm" onClick={handleConfirmAdd}>Agregar al carrito</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Venta exitosa */}
      {showSuccessModal && ultimoCobro && (
        <div className="pos-modal-bg">
          <div className="pos-modal pos-modal-success">
            <div className="pos-success-icon">
              <CheckCircle2 size={42} strokeWidth={1.5} />
            </div>
            <h3>¡Venta completada!</h3>
            <p>La transacción fue guardada correctamente.</p>

            <div className="pos-success-summary">
              <div>
                <span>Total cobrado</span>
                <strong>{formatMoney(ultimoCobro.total)}</strong>
              </div>
              <div>
                <span>Efectivo recibido</span>
                <strong>{formatMoney(ultimoCobro.pagoCon)}</strong>
              </div>
              <div className="pos-success-vuelto">
                <span>Vuelto entregado</span>
                <strong>{formatMoney(ultimoCobro.vuelto)}</strong>
              </div>
            </div>

            <div className="pos-modal-actions">
              <button className="pos-modal-cancel" onClick={() => generateTicketPDF(ultimoCobro)}>
                <Receipt size={15} strokeWidth={1.75} />
                Imprimir ticket
              </button>
              <button className="pos-modal-confirm" onClick={() => setShowSuccessModal(false)}>
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Arqueo de caja */}
      {showArqueoModal && (
        <div className="pos-modal-bg" onClick={() => setShowArqueoModal(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>Arqueo de Caja</h3>
              <button className="pos-modal-close" onClick={() => setShowArqueoModal(false)}>
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <p className="pos-modal-desc">
              Registre el sobrante o faltante de efectivo detectado en caja al final del turno.
            </p>
            <div className="pos-modal-field">
              <label>Monto de discrepancia (S/)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej. 5.50 (sobrante) · -3.20 (faltante)"
                value={montoArqueo}
                onChange={(e) => setMontoArqueo(e.target.value)}
              />
            </div>
            <div className="pos-modal-field">
              <label>Explicación / Nota</label>
              <textarea
                rows={3}
                placeholder="Describa el motivo del cuadre…"
                value={notaArqueo}
                onChange={(e) => setNotaArqueo(e.target.value)}
              />
            </div>
            <div className="pos-modal-actions">
              <button className="pos-modal-cancel" onClick={() => setShowArqueoModal(false)}>Cancelar</button>
              <button className="pos-modal-confirm" onClick={handleRegistrarArqueo}>Registrar arqueo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Tickets del día */}
      {showTicketsModal && (
        <div className="pos-modal-bg" onClick={() => setShowTicketsModal(false)}>
          <div className="pos-modal pos-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>Tickets de hoy</h3>
              <button className="pos-modal-close" onClick={() => setShowTicketsModal(false)}>
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="pos-tickets-table-wrap">
              <table className="pos-table pos-tickets-table">
                <thead>
                  <tr>
                    <th>N° Ticket</th>
                    <th>Hora</th>
                    <th>Vendedor</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsDia.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="pos-empty" style={{ padding: "32px 0" }}>
                          <Receipt size={32} strokeWidth={1} />
                          <p>Sin tickets registrados hoy</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ticketsDia.map((t) => (
                      <tr key={t.id}>
                        <td><span className="pos-ticket-num">#{t.id}</span></td>
                        <td>{new Date(t.fecha).toLocaleTimeString()}</td>
                        <td>{t.usuario.nombreVendedor}</td>
                        <td className="pos-td-price">{formatMoney(t.total)}</td>
                        <td>
                          <button
                            className="pos-reprint-btn"
                            onClick={() => generateTicketPDF(t)}
                          >
                            Reimprimir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button className="pos-modal-cancel" style={{ marginTop: "20px", width: "100%" }} onClick={() => setShowTicketsModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────── ESTILOS ─────────────────────────────── */}
      <style>{`
        /* Tokens */
        .pos-root {
          --red:        #e11d48;
          --red-dark:   #9f1239;
          --red-glow:   rgba(225,29,72,.14);
          --green:      #10b981;
          --green-bg:   rgba(16,185,129,.08);
          --amber:      #f59e0b;
          --amber-bg:   rgba(245,158,11,.08);
          --bg:         #f4f6f9;
          --surface:    #ffffff;
          --border:     rgba(15,23,42,.08);
          --border-md:  rgba(15,23,42,.12);
          --text:       #0f172a;
          --text-muted: #64748b;
          --sidebar:    #0f172a;
          --sidebar-2:  #1e293b;
          --radius:     12px;
          --radius-sm:  8px;

          display: flex;
          height: calc(100vh - 76px);
          overflow: hidden;
          background: var(--bg);
          font-family: var(--font-outfit), system-ui, sans-serif;
          padding: 20px 24px;
          gap: 20px;
        }

        /* ══ CATÁLOGO ══ */
        .pos-catalog {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
        }

        /* Topbar */
        .pos-topbar {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .pos-search-wrap {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
        }

        .pos-search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
          z-index: 1;
        }

        .pos-search {
          width: 100%;
          height: 46px;
          padding: 0 165px 0 44px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          outline: none;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text);
          transition: border-color .18s, box-shadow .18s;
        }

        .pos-search::placeholder { color: #94a3b8; }

        .pos-search:focus {
          border-color: var(--red);
          box-shadow: none;
        }

        .pos-search-actions {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 2;
        }

        .pos-search-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          transition: color .15s, background .15s;
        }

        .pos-search-badge {
          background: #0f172a;
          color: #ffffff;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          pointer-events: none;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pos-search-clear:hover { color: var(--text); background: rgba(15,23,42,.06); }

        .pos-action-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          height: 46px;
          padding: 0 18px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius);
          color: var(--text);
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color .18s, background .18s, transform .12s;
        }

        .pos-action-btn:hover {
          border-color: var(--border-md);
          background: #f8fafc;
          transform: translateY(-1px);
        }


        .pos-loading-text { color: var(--text-muted); }

        /* Tabla */
        .pos-table-wrap {
          max-height: 100%;
          overflow-y: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge Legacy */
          border-radius: var(--radius);
          border: 1.5px solid rgba(15, 23, 42, 0.18);
          background: var(--surface);
          box-shadow: 0 2px 12px rgba(15,23,42,.04);
        }

        .pos-table-wrap::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Edge */
        }

        .pos-table {
          width: 100%;
          border-collapse: collapse;
        }

        .pos-table {
          width: 100%;
          border-collapse: collapse;
        }

        .pos-table thead tr {
          position: sticky;
          top: 0;
          z-index: 2;
        }

        .pos-table thead th {
          padding: 9px 12px;
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: #f8fafc;
          border-bottom: 1.5px solid rgba(15, 23, 42, 0.08);
          white-space: nowrap;
        }

        .pos-table td {
          padding: 10px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text);
          border-bottom: 1.5px solid rgba(15, 23, 42, 0.18);
          transition: background .12s;
        }


        .pos-table tbody tr { cursor: pointer; }
        .pos-table tbody tr:not(.pos-row-disabled):hover td { background: rgba(225, 29, 72, 0.05); }
        .pos-table tbody tr:not(.pos-row-disabled):active td { background: rgba(225, 29, 72, 0.12); }
        .pos-table tbody tr:last-child td { border-bottom: none; }

        .pos-row-disabled td { opacity: .45; pointer-events: none; }

        .pos-td-name-inner {
          font-weight: 700 !important;
          max-width: 180px;
          white-space: normal;
          word-break: break-word;
        }

        .pos-text-center {
          text-align: center !important;
        }

        .pos-pill-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(225,29,72,.07);
          color: var(--red);
          flex-shrink: 0;
        }

        .pos-td-price { font-weight: 700 !important; font-variant-numeric: tabular-nums; }

        .pos-badge-cat {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(14,165,233,.08);
          border: 1px solid rgba(14,165,233,.15);
          color: #0369a1;
          font-size: 0.73rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .pos-badge-stock {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.73rem;
          font-weight: 700;
          white-space: nowrap;
        }

        .pos-badge-ok {
          background: var(--green-bg);
          border: 1px solid rgba(16,185,129,.2);
          color: #047857;
        }

        .pos-badge-low {
          background: var(--amber-bg);
          border: 1px solid rgba(245,158,11,.2);
          color: #b45309;
        }

        .pos-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          background: var(--red);
          border: none;
          color: #fff;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: filter .18s, transform .12s, box-shadow .18s;
          box-shadow: 0 4px 12px rgba(225,29,72,.2);
        }

        .pos-add-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(225,29,72,.3);
        }

        .pos-add-btn:disabled {
          opacity: .35;
          cursor: not-allowed;
          box-shadow: none;
        }

        .pos-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 60px 0;
          color: #94a3b8;
        }

        .pos-empty p { font-size: 0.9rem; font-weight: 600; margin: 0; }

        /* Skeleton */
        .pos-skeleton-list { display: flex; flex-direction: column; gap: 2px; padding: 8px; }
        .pos-skeleton-row {
          height: 52px;
          border-radius: var(--radius-sm);
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: pos-shimmer 1.4s ease infinite;
        }

        @keyframes pos-shimmer {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }

        /* ══ CARRITO ══ */
        .pos-cart {
          width: 330px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.18);
          border-radius: var(--radius);
          box-shadow: 0 2px 12px rgba(15,23,42,.04);
          overflow: hidden;
        }

        /* Hero total */
        .pos-cart-hero {
          padding: 22px 20px 18px;
          background: #ffffff;
          border-bottom: 1px solid rgba(29,29,31,.06);
          border-radius: 14px;
          margin: 12px 12px 0;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0,0,0,.04);
          border: 1px solid rgba(15, 23, 42, 0.15);
        }

        .pos-cart-hero-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(29,29,31,.45);
          margin-bottom: 10px;
        }

        .pos-cart-hero-label svg { color: #FF3B30; }

        .pos-cart-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: #FF3B30;
          color: #fff;
          font-size: 0.68rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pos-cart-hero-total {
          margin: 0;
          font-size: 2.1rem;
          font-weight: 800;
          color: #FF3B30;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        .pos-cart-hero-sub {
          margin: 6px 0 0;
          font-size: 0.65rem;
          font-weight: 800;
          color: rgba(29,29,31,.28);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* Items list */
        .pos-cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pos-cart-items::-webkit-scrollbar { width: 3px; }
        .pos-cart-items::-webkit-scrollbar-thumb { background: rgba(29,29,31,.1); border-radius: 4px; }

        .pos-cart-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #d1d5db;
          padding: 40px 0;
        }

        .pos-cart-empty p { font-size: 0.88rem; font-weight: 700; color: #9ca3af; margin: 0; }
        .pos-cart-empty small { font-size: 0.75rem; font-weight: 500; color: #d1d5db; }

        .pos-cart-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 14px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.14);
          transition: background .12s;
        }

        .pos-cart-item:hover { background: #fafafa; }

        .pos-cart-item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .pos-cart-item-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1E293B;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pos-cart-item-tags {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }

        .pos-cart-tag {
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(255,59,48,.06);
          color: #FF3B30;
          font-size: 0.67rem;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .pos-cart-item-qty {
          font-size: 0.68rem;
          font-weight: 700;
          color: rgba(29,29,31,.28);
          letter-spacing: 0.03em;
        }

        .pos-cart-item-subtotal {
          font-size: 0.95rem;
          font-weight: 800;
          color: #1D1D1F;
          font-variant-numeric: tabular-nums;
          margin-top: 4px;
        }

        .pos-cart-item-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .pos-remove-btn {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          opacity: 0.65;
          transition: opacity .15s;
        }

        .pos-remove-btn:hover { opacity: 1; }

        .pos-qty-ctrl {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pos-qty-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 5px;
          background: #f3f4f6;
          border: 1px solid rgba(29,29,31,.08);
          color: #1D1D1F;
          cursor: pointer;
          transition: background .12s;
        }

        .pos-qty-btn:hover { background: #e5e7eb; }

        .pos-qty-val {
          min-width: 20px;
          text-align: center;
          font-size: 0.88rem;
          font-weight: 800;
          color: #1D1D1F;
        }

        /* Cobro */
        .pos-cobro {
          padding: 0 12px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Calculadora estilo Flutter */
        .pos-calc-box {
          padding: 14px 16px;
          background: #F5F5F7;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.15);
        }

        .pos-calc-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.68rem;
          font-weight: 800;
          color: rgba(29,29,31,.38);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
        }

        .pos-calc-row {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .pos-calc-input-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pos-calc-prefix {
          font-size: 1rem;
          font-weight: 600;
          color: #1D1D1F;
          flex-shrink: 0;
        }

        .pos-cobro-input {
          flex: 1;
          width: 100%;
          height: 36px;
          padding: 0;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 1.2rem;
          font-weight: 700;
          color: #1D1D1F;
        }

        .pos-cobro-input:disabled { opacity: .35; cursor: not-allowed; }
        .pos-cobro-input::placeholder { color: rgba(29,29,31,.2); font-size: 1rem; font-weight: 400; }

        .pos-calc-divider {
          width: 1px;
          height: 32px;
          background: rgba(29,29,31,.1);
          margin: 0 14px;
          flex-shrink: 0;
        }

        .pos-calc-vuelto {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .pos-vuelto-label-green { font-size: 0.65rem; font-weight: 800; color: #34C759; letter-spacing: 0.08em; }
        .pos-vuelto-label-gray  { font-size: 0.65rem; font-weight: 800; color: rgba(29,29,31,.28); letter-spacing: 0.08em; }

        .pos-vuelto-amount {
          font-size: 1.2rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .pos-vuelto-green { color: #34C759; }
        .pos-vuelto-gray  { color: rgba(29,29,31,.25); }

        .pos-cobrar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 54px;
          border-radius: 12px;
          background: #FF3B30;
          border: none;
          color: #fff;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(255,59,48,.22);
          transition: filter .18s, transform .12s, box-shadow .18s;
        }

        .pos-cobrar-btn:hover:not(:disabled) {
          filter: brightness(1.07);
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(255,59,48,.3);
        }

        .pos-cobrar-btn:disabled { opacity: .35; cursor: not-allowed; transform: none; box-shadow: none; }

        .pos-cancel-btn {
          background: none;
          border: none;
          color: rgba(29,29,31,.3);
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.78rem;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          text-decoration: underline;
          transition: color .15s;
        }

        .pos-cancel-btn:hover { color: rgba(29,29,31,.6); }

        .pos-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: pos-spin .6s linear infinite;
        }

        @keyframes pos-spin { to { transform: rotate(360deg); } }

        /* ══ MODALES ══ */
        .pos-modal-bg {
          --red:        #e11d48;
          --red-dark:   #9f1239;
          --text-muted: #64748b;
          --text:       #0f172a;
          --border:     rgba(15,23,42,.08);

          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: pos-fade-in .18s ease;
        }

        @keyframes pos-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .pos-modal {
          width: min(100%, 390px);
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.06);
          animation: pos-slide-up .22s cubic-bezier(.16,1,.3,1);
        }

        .pos-modal-wide { width: min(100%, 660px); }

        @keyframes pos-slide-up {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        .pos-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .pos-modal-kicker {
          display: block;
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .pos-modal-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        .pos-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: #f1f5f9;
          border: none;
          color: #64748b;
          cursor: pointer;
          transition: background .12s, color .12s;
        }

        .pos-modal-close:hover { background: #e2e8f0; color: #0f172a; }

        .pos-modal-desc {
          font-size: 0.88rem;
          font-weight: 500;
          color: #64748b;
          margin-bottom: 20px;
          line-height: 1.55;
        }

        .pos-modal-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .pos-modal-field label {
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pos-modal-segments {
          display: flex;
          gap: 6px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.02);
        }

        .pos-modal-segment {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 8px 4px;
          border-radius: 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pos-modal-segment.active {
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.02);
        }

        .segment-label {
          font-size: 0.76rem;
          font-weight: 700;
          color: #64748b;
          transition: color 0.12s;
        }

        .pos-modal-segment.active .segment-label {
          color: #0f172a;
        }

        .segment-price {
          font-size: 0.78rem;
          font-weight: 800;
          color: #94a3b8;
          font-variant-numeric: tabular-nums;
          transition: color 0.12s;
        }

        .pos-modal-segment.active .segment-price {
          color: var(--red);
        }

        .pos-modal-field input,
        .pos-modal-field textarea {
          width: 100%;
          padding: 10px 12px;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 8px;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.88rem;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          transition: border-color .18s, background-color .18s;
          resize: none;
        }

        .pos-modal-field input:focus,
        .pos-modal-field textarea:focus {
          border-color: var(--red);
          background-color: #ffffff;
          box-shadow: none;
        }

        .pos-modal-footer-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 14px;
          border-top: 1px solid rgba(15, 23, 42, 0.06);
          margin-top: 18px;
        }

        .pos-modal-qty {
          display: flex;
          align-items: center;
          gap: 2px;
          border: 1.5px solid rgba(15, 23, 42, 0.06);
          border-radius: 8px;
          background: #f8fafc;
          padding: 2px;
          width: 115px;
        }

        .pos-modal-qty button {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.05);
          color: #0f172a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .12s, transform .08s;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .pos-modal-qty button:active {
          transform: scale(0.92);
        }

        .pos-modal-qty input {
          width: 44px !important;
          height: 28px !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          text-align: center !important;
          font-family: var(--font-outfit), sans-serif !important;
          font-size: 0.95rem !important;
          font-weight: 700 !important;
          color: #0f172a !important;
          box-shadow: none !important;
        }

        .pos-modal-total-display {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .total-label {
          font-size: 0.68rem;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .total-val {
          font-size: 1.15rem;
          font-weight: 900;
          color: var(--red);
          letter-spacing: -0.02em;
        }

        .pos-modal-actions {
          display: flex;
          gap: 8px;
          margin-top: 20px;
        }

        .pos-modal-cancel {
          flex: 1;
          height: 40px;
          border-radius: 8px;
          background: #f1f5f9;
          border: none;
          color: #475569;
          font-family: var(--font-outfit), sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: background .12s;
        }

        .pos-modal-cancel:hover { background: #e2e8f0; }

        .pos-modal-confirm {
          flex: 1.6;
          height: 40px;
          border-radius: 8px;
          background: var(--red);
          border: none;
          color: #fff;
          font-family: var(--font-outfit), sans-serif;
          font-size: 0.82rem;
          font-weight: 800;
          cursor: pointer;
          transition: filter .12s, transform .12s;
        }

        .pos-modal-confirm:hover { filter: brightness(1.06); }
        .pos-modal-confirm:active { transform: translateY(1px); }

        /* Modal Éxito */
        .pos-modal-success { text-align: center; }

        .pos-success-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(16,185,129,.1);
          border: 2px solid rgba(16,185,129,.2);
          color: #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
        }

        .pos-modal-success h3 {
          margin: 0 0 8px;
          font-size: 1.3rem;
          font-weight: 900;
          color: #0f172a;
        }

        .pos-modal-success > p {
          margin: 0 0 20px;
          font-size: 0.88rem;
          color: #64748b;
        }

        .pos-success-summary {
          background: #f8fafc;
          border: 1px solid rgba(15,23,42,.07);
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 4px;
          text-align: left;
        }

        .pos-success-summary > div {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pos-success-summary span {
          font-size: 0.83rem;
          font-weight: 600;
          color: #64748b;
        }

        .pos-success-summary strong {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
        }

        .pos-success-vuelto { 
          border-top: 1px solid rgba(15,23,42,.07);
          padding-top: 10px;
        }

        .pos-success-vuelto span { color: #047857 !important; }
        .pos-success-vuelto strong { color: #047857 !important; }

        /* Tickets */
        .pos-tickets-table-wrap {
          max-height: 55vh;
          overflow-y: auto;
          border: 1.5px solid rgba(15, 23, 42, 0.18);
          border-radius: var(--radius);
        }

        .pos-tickets-table th,
        .pos-tickets-table td { padding: 12px 16px; }

        .pos-ticket-num {
          font-weight: 800;
          color: #0f172a;
          font-size: 0.88rem;
        }

        .pos-reprint-btn {
          padding: 5px 12px;
          border-radius: 7px;
          background: #f1f5f9;
          border: 1.5px solid rgba(15,23,42,.08);
          color: #475569;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: background .15s;
        }

        .pos-reprint-btn:hover { background: #e2e8f0; }

        /* ══ PANEL CENTRAL: Ventas del Día ══ */
        .pos-ventas-dia {
          width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.18);
          border-radius: var(--radius);
          box-shadow: 0 2px 12px rgba(15,23,42,.04);
          overflow: hidden;
        }

        .pos-ventas-hero {
          padding: 22px 20px 18px;
          background: #ffffff;
          border-bottom: 1px solid rgba(29,29,31,.06);
          border-radius: 14px;
          margin: 12px 12px 0;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0,0,0,.04);
          border: 1px solid rgba(15, 23, 42, 0.15);
        }

        .pos-ventas-hero-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(29,29,31,.45);
          margin-bottom: 10px;
        }

        .pos-ventas-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: #10b981;
          color: #fff;
          font-size: 0.68rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pos-ventas-hero-total {
          margin: 0;
          font-size: 2.1rem;
          font-weight: 800;
          color: #10b981;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        .pos-ventas-hero-sub {
          margin: 6px 0 0;
          font-size: 0.65rem;
          font-weight: 800;
          color: rgba(29,29,31,.28);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pos-ventas-items {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pos-ventas-items::-webkit-scrollbar { width: 3px; }
        .pos-ventas-items::-webkit-scrollbar-thumb { background: rgba(29,29,31,.1); border-radius: 4px; }

        .pos-ventas-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px 0;
          color: var(--text-muted);
        }

        .pos-ventas-loading p { font-size: 0.88rem; font-weight: 600; margin: 0; }

        .pos-ventas-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #d1d5db;
          padding: 40px 0;
        }

        .pos-ventas-empty p { font-size: 0.88rem; font-weight: 700; color: #9ca3af; margin: 0; }
        .pos-ventas-empty small { font-size: 0.75rem; font-weight: 500; color: #d1d5db; }

        .pos-venta-card {
          padding: 12px 14px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.14);
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: border-color .12s, box-shadow .12s;
        }

        .pos-venta-card:hover {
          border-color: rgba(16,185,129,.2);
          box-shadow: 0 4px 12px rgba(16,185,129,.04);
        }

        .pos-venta-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pos-venta-ticket {
          font-size: 0.82rem;
          font-weight: 800;
          color: #0f172a;
        }

        .pos-venta-time {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .pos-venta-details {
          display: flex;
          flex-direction: column;
          gap: 3px;
          border-top: 1px dashed rgba(15,23,42,.06);
          border-bottom: 1px dashed rgba(15,23,42,.06);
          padding: 6px 0;
        }

        .pos-venta-det-row {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
        }

        .pos-venta-det-qty {
          color: #10b981;
          font-weight: 700;
        }

        .pos-venta-det-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #1e293b;
        }

        .pos-venta-det-type {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .pos-venta-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 2px;
        }

        .pos-venta-total-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .pos-venta-total-label {
          font-size: 0.6rem;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }

        .pos-venta-total-val {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
        }

        .pos-venta-reprint-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 6px;
          background: #f1f5f9;
          border: 1.5px solid rgba(15,23,42,.08);
          color: #475569;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.73rem;
          font-weight: 700;
          cursor: pointer;
          transition: background .12s, border-color .12s, color .12s;
        }

        .pos-venta-reprint-btn:hover {
          background: rgba(16,185,129,.05);
          border-color: rgba(16,185,129,.2);
          color: #047857;
        }
      `}</style>
    </>
  );
}
