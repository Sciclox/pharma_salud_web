"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ShoppingCart, Receipt, DollarSign, Plus, Minus, Trash2, ShieldAlert, CheckCircle2, X } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatMoney } from "@/lib/format";
import jsPDF from "jspdf";

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
    loading: cartLoading 
  } = useCart();

  // Estados de POS
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<InventarioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingInventario, setLoadingInventario] = useState<boolean>(true);
  
  // Modales
  const [selectedProduct, setSelectedProduct] = useState<InventarioItem | null>(null);
  const [tipoVenta, setTipoVenta] = useState<string>("Venta por unidad");
  const [cantidadAñadir, setCantidadAñadir] = useState<number>(1);
  
  // Cobro
  const [pagoCon, setPagoCon] = useState<string>("");
  const [vuelto, setVuelto] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [ultimoCobro, setUltimoCobro] = useState<any>(null);

  // Arqueo de Caja Modal
  const [showArqueoModal, setShowArqueoModal] = useState<boolean>(false);
  const [montoArqueo, setMontoArqueo] = useState<string>("");
  const [notaArqueo, setNotaArqueo] = useState<string>("");

  // Tickets del Día Modal
  const [showTicketsModal, setShowTicketsModal] = useState<boolean>(false);
  const [ticketsDia, setTicketsDia] = useState<any[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar inventario de la sucursal del vendedor
  const fetchInventario = useCallback(async () => {
    setLoadingInventario(true);
    try {
      // La API /api/inventarios autodetectará la sucursal del vendedor logueado
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

  useEffect(() => {
    fetchInventario();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [fetchInventario]);

  // Filtrar productos reactivamente al escribir
  useEffect(() => {
    if (!searchQuery) {
      setProductosFiltrados(inventario);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = inventario.filter(item => 
        item.producto.nombreProducto.toLowerCase().includes(query) ||
        (item.producto.tipoProducto && item.producto.tipoProducto.toLowerCase().includes(query))
      );
      setProductosFiltrados(filtered);
    }
  }, [searchQuery, inventario]);

  // Cargar tickets del día
  const fetchTicketsDia = async () => {
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/ventas?fechaInicio=${hoy}&fechaFin=${hoy}`);
      if (res.ok) {
        const data = await res.json();
        setTicketsDia(data);
      }
    } catch (error) {
      console.error("Error al cargar tickets:", error);
    }
  };

  // Calcular vuelto reactivamente
  const subtotal = getSubtotal();
  useEffect(() => {
    const pago = parseFloat(pagoCon) || 0;
    if (pago >= subtotal && subtotal > 0) {
      setVuelto(pago - subtotal);
    } else {
      setVuelto(0);
    }
  }, [pagoCon, subtotal]);

  // Agregar al carrito
  const handleOpenAddModal = (item: InventarioItem) => {
    setSelectedProduct(item);
    setTipoVenta("Venta por unidad");
    setCantidadAñadir(1);
  };

  const handleConfirmAdd = async () => {
    if (!selectedProduct) return;
    
    // Obtener el precio adecuado según el tipo de venta
    let precio = selectedProduct.precioUnidad;
    if (tipoVenta === "Venta por caja") {
      precio = selectedProduct.precioCaja;
    } else if (tipoVenta === "Venta por blíster") {
      // En el POS de Flutter, el blíster se calcula dividiendo el precio de caja entre 10 por defecto
      // o según la presentación del blíster.
      const factorBlister = selectedProduct.producto.cantidadPresentacionBlister || 10;
      const factorCaja = selectedProduct.producto.cantidadPresentacion || 100;
      precio = (selectedProduct.precioCaja / factorCaja) * factorBlister;
    }

    const success = await addToCart(selectedProduct.productoId, cantidadAñadir, precio, tipoVenta);
    if (success) {
      setSelectedProduct(null);
      setSearchQuery("");
      if (searchInputRef.current) searchInputRef.current.focus();
    }
  };

  // Procesar Cobro
  const handleCobrar = async () => {
    if (subtotal <= 0) return;
    const pago = parseFloat(pagoCon) || 0;
    if (pago < subtotal) {
      alert("El monto de pago es insuficiente");
      return;
    }

    const res = await checkout(pago, vuelto);
    if (res.success) {
      setUltimoCobro(res);
      setShowSuccessModal(true);
      setPagoCon("");
      setVuelto(0);
      fetchInventario(); // Recargar stock en el POS
    } else {
      alert(`Error al procesar cobro: ${res.error}`);
    }
  };

  // Registrar Arqueo de Caja
  const handleRegistrarArqueo = async () => {
    const monto = parseFloat(montoArqueo);
    if (isNaN(monto)) {
      alert("Ingrese un monto válido de arqueo");
      return;
    }

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

  // Generar Ticket PDF de 80mm e Imprimir
  const generateTicketPDF = (venta: any) => {
    // Formato de Ticket Térmico 80mm
    const doc = new jsPDF({
      unit: "mm",
      format: [80, 150], // Ancho 80mm, Alto 150mm (dinámico)
    });

    doc.setFont("courier");
    doc.setFontSize(9);

    // Encabezado
    doc.text("BOTICA PHARMA SALUD", 40, 10, { align: "center" });
    doc.setFontSize(8);
    doc.text("RUC: 10427847118", 40, 14, { align: "center" });
    doc.text("Av. Larco 456, Trujillo", 40, 18, { align: "center" });
    doc.text("--------------------------------", 40, 22, { align: "center" });

    // Meta
    doc.text(`TICKET N°: 0000${venta.ventaId}`, 5, 27);
    doc.text(`FECHA: ${new Date().toLocaleString()}`, 5, 31);
    doc.text("--------------------------------", 40, 36, { align: "center" });

    // Columnas
    doc.text("CANT  DESCRIPCIÓN      IMPORTE", 5, 41);
    doc.text("--------------------------------", 40, 45, { align: "center" });

    // Items (Carrito recuperado)
    let y = 50;
    // Como el carrito ya se vació en BD, podemos listar los detalles de la venta del objeto devuelto
    if (cartItems.length > 0) {
      cartItems.forEach(item => {
        const desc = item.producto.nombreProducto.substring(0, 16);
        const sub = item.cantidad * item.precioVenta;
        doc.text(`${item.cantidad.toString().padEnd(4)}  ${desc.padEnd(16)} S/${sub.toFixed(2)}`, 5, y);
        y += 5;
      });
    } else {
      doc.text("Productos procesados en venta.", 5, y);
      y += 5;
    }

    doc.text("--------------------------------", 40, y + 2, { align: "center" });
    y += 7;

    // Totales
    doc.text(`TOTAL:        S/${venta.total.toFixed(2)}`, 45, y);
    doc.text(`RECIBIDO:     S/${venta.pagoCon.toFixed(2)}`, 45, y + 4);
    doc.text(`CAMBIO:       S/${venta.vuelto.toFixed(2)}`, 45, y + 8);

    y += 15;
    doc.text("GRACIAS POR SU PREFERENCIA", 40, y, { align: "center" });
    doc.text("VUELVA PRONTO", 40, y + 4, { align: "center" });

    // Guardar o abrir previsualización
    window.open(doc.output("bloburl"), "_blank");
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "calc(100vh - 76px)", backgroundColor: "hsl(var(--background))" }}>
      {/* PANEL IZQUIERDO: Inventario & Buscador */}
      <div 
        style={{ 
          flex: 7, 
          display: "flex", 
          flexDirection: "column", 
          padding: "32px", 
          borderRight: "1px solid hsl(var(--card-border))",
          overflowY: "auto"
        }}
      >
        {/* Buscador y Botones Rápidos */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              ref={searchInputRef}
              type="text"
              className="input-field"
              placeholder="Buscar medicamentos por nombre o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                paddingLeft: "46px",
                borderRadius: "14px",
                border: "1px solid hsl(var(--card-border))",
                height: "48px"
              }}
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
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "hsl(var(--muted-foreground))"
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button 
            className="btn btn-outline"
            onClick={() => {
              fetchTicketsDia();
              setShowTicketsModal(true);
            }}
            style={{ display: "flex", gap: "8px", height: "48px", borderRadius: "14px" }}
          >
            <Receipt size={16} />
            Tickets
          </button>

          <button 
            className="btn btn-outline"
            onClick={() => setShowArqueoModal(true)}
            style={{ display: "flex", gap: "8px", height: "48px", borderRadius: "14px" }}
          >
            <DollarSign size={16} />
            Cierre
          </button>
        </div>

        {/* Listado de Productos */}
        {loadingInventario ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
            <p style={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Cargando inventario de sucursal...</p>
          </div>
        ) : (
          <div className="table-container" style={{ flex: 1, border: "1px solid hsl(var(--card-border))", borderRadius: "18px" }}>
            <table className="table-custom">
              <thead>
                <tr>
                  <th style={{ padding: "18px 24px" }}>Medicamento</th>
                  <th style={{ padding: "18px 24px" }}>Categoría</th>
                  <th style={{ padding: "18px 24px" }}>Stock Físico</th>
                  <th style={{ padding: "18px 24px" }}>P. Caja</th>
                  <th style={{ padding: "18px 24px" }}>P. Unidad</th>
                  <th style={{ padding: "18px 24px" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", padding: "32px" }}>
                      No se encontraron medicamentos en esta sucursal.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((item) => {
                    const factorCaja = item.producto.cantidadPresentacion || 1;
                    const stockCajas = Math.floor(item.cantidadTotal / factorCaja);
                    const stockUnidades = item.cantidadTotal % factorCaja;
                    const stockTxt = `${stockCajas} cj + ${stockUnidades} und`;
                    const esBajoStock = item.cantidadTotal <= item.stockMinimo;

                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700, padding: "20px 24px" }}>{item.producto.nombreProducto}</td>
                        <td style={{ padding: "20px 24px" }}>
                          <span className="badge badge-info" style={{ borderRadius: "8px" }}>{item.producto.tipoProducto || "General"}</span>
                        </td>
                        <td style={{ padding: "20px 24px" }}>
                          <span 
                            className={`badge-premium ${esBajoStock ? "badge-premium-danger" : "badge-premium-success"}`}
                            style={{ fontWeight: 700 }}
                          >
                            {stockTxt}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, padding: "20px 24px" }}>{formatMoney(item.precioCaja)}</td>
                        <td style={{ fontWeight: 700, padding: "20px 24px" }}>{formatMoney(item.precioUnidad)}</td>
                        <td style={{ padding: "20px 24px" }}>
                          <button 
                            className="btn btn-shimmer"
                            onClick={() => handleOpenAddModal(item)}
                            disabled={item.cantidadTotal <= 0}
                            style={{
                              padding: "10px 18px",
                              fontSize: "0.82rem",
                              borderRadius: "10px",
                            }}
                          >
                            <Plus size={14} />
                            Agregar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PANEL DERECHO: Carrito de Compras & Cobro */}
      <div 
        style={{ 
          flex: 3, 
          display: "flex", 
          flexDirection: "column", 
          background: "hsl(var(--card))",
          padding: "32px 24px",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
          <div className="glow-icon glow-icon-primary" style={{ width: "36px", height: "36px" }}>
            <ShoppingCart size={18} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Carrito de Ventas</h2>
        </div>

        {/* Items del Carrito */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", marginBottom: "20px" }}>
          {cartItems.length === 0 ? (
            <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))" }}>
              <ShoppingCart size={40} style={{ strokeWidth: 1, marginBottom: "12px" }} />
              <p style={{ fontSize: "0.9rem" }}>El carrito está vacío</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div 
                key={item.id} 
                className="fade-in"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid hsl(var(--card-border))",
                  backgroundColor: "hsl(var(--background))",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.producto.nombreProducto}</span>
                  <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
                    {item.tipoVenta} | Unit: {formatMoney(item.precioVenta)}
                  </span>
                  
                  {/* Modificador de Cantidad */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border: "1px solid hsl(var(--card-border))",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.cantidad}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        border: "1px solid hsl(var(--card-border))",
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "end", justifyContent: "space-between" }}>
                  <button 
                    onClick={() => removeItem(item.id)}
                    style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer" }}
                  >
                    <Trash2 size={16} />
                  </button>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                    {formatMoney(item.cantidad * item.precioVenta)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sección de Pago y Total */}
        <div 
          style={{
            borderTop: "1.5px dashed hsl(var(--card-border))",
            paddingTop: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Subtotal */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 700, fontSize: "0.95rem" }}>Total a Pagar:</span>
            <span style={{ fontSize: "2rem", fontWeight: 900, color: "hsl(var(--primary))", letterSpacing: "-0.03em" }}>
              {formatMoney(subtotal)}
            </span>
          </div>

          {/* Recibido */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: "0.78rem", color: "hsl(var(--muted-foreground))" }}>Efectivo Recibido (S/)</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ej. S/ 50.00"
              value={pagoCon}
              onChange={(e) => setPagoCon(e.target.value)}
              disabled={subtotal <= 0}
              style={{ 
                fontWeight: 700,
                borderRadius: "12px",
                padding: "14px 18px",
                border: "1.5px solid hsl(var(--card-border))",
              }}
            />
          </div>

          {/* Vuelto */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 700, fontSize: "0.95rem" }}>Vuelto (Cambio):</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 900, color: vuelto > 0 ? "hsl(var(--success))" : "hsl(var(--foreground))" }}>
              {formatMoney(vuelto)}
            </span>
          </div>

          {/* Botón Cobrar */}
          <button
            className="btn btn-shimmer"
            onClick={handleCobrar}
            disabled={subtotal <= 0 || !pagoCon || parseFloat(pagoCon) < subtotal || cartLoading}
            style={{
              width: "100%",
              height: "54px",
              fontSize: "1.05rem",
              borderRadius: "14px",
            }}
          >
            {cartLoading ? "Procesando venta..." : "Completar Venta y Cobrar"}
          </button>

          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              style={{
                background: "none",
                border: "none",
                color: "hsl(var(--muted-foreground))",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline",
                textAlign: "center",
                fontWeight: 600,
                marginTop: "4px"
              }}
            >
              Cancelar venta actual (Vaciar)
            </button>
          )}
        </div>
      </div>

      {/* MODAL 1: Selección de Producto */}
      {selectedProduct && (
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
              onClick={() => setSelectedProduct(null)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem" }}>
              Agregar a la venta
            </h3>
            <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "hsl(var(--foreground))", marginBottom: "20px" }}>
              {selectedProduct.producto.nombreProducto}
            </p>

            {/* Tipo de Venta */}
            <div className="form-group">
              <label className="form-label">Tipo de Venta:</label>
              <select
                className="input-field"
                value={tipoVenta}
                onChange={(e) => setTipoVenta(e.target.value)}
              >
                <option value="Venta por unidad">Por Unidad (S/ {selectedProduct.precioUnidad.toFixed(2)})</option>
                {selectedProduct.precioCaja > 0 && (
                  <option value="Venta por caja">Por Caja (S/ {selectedProduct.precioCaja.toFixed(2)})</option>
                )}
                {selectedProduct.producto.cantidadPresentacionBlister && (
                  <option value="Venta por blíster">Por Blíster</option>
                )}
              </select>
            </div>

            {/* Cantidad */}
            <div className="form-group">
              <label className="form-label">Cantidad a llevar:</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={cantidadAñadir}
                onChange={(e) => setCantidadAñadir(parseInt(e.target.value) || 1)}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setSelectedProduct(null)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirmAdd} style={{ flex: 1 }}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Venta Exitosa */}
      {showSuccessModal && ultimoCobro && (
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
          <div className="card" style={{ width: "400px", textAlign: "center", padding: "32px" }}>
            <CheckCircle2 size={54} style={{ color: "hsl(var(--success))", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: "1.4rem", marginBottom: "8px" }}>¡Venta Completada!</h3>
            <p style={{ marginBottom: "20px" }}>La transacción ha sido guardada en la sucursal.</p>

            <div 
              style={{
                background: "hsl(var(--muted))",
                padding: "16px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total:</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(ultimoCobro.total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Recibido:</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(ultimoCobro.pagoCon)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--success))" }}>
                <span>Vuelto:</span>
                <span style={{ fontWeight: 800 }}>{formatMoney(ultimoCobro.vuelto)}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="btn btn-primary" onClick={() => generateTicketPDF(ultimoCobro)}>
                Imprimir Ticket (PDF)
              </button>
              <button className="btn btn-outline" onClick={() => setShowSuccessModal(false)}>
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Arqueo / Cierre de Caja */}
      {showArqueoModal && (
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
              onClick={() => setShowArqueoModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "16px", fontSize: "1.2rem" }}>
              Declarar Arqueo Diario de Caja
            </h3>
            <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", marginBottom: "20px" }}>
              Registre cualquier excedente (sobrante) o déficit (faltante) de efectivo detectado en caja.
            </p>

            <div className="form-group">
              <label className="form-label">Monto de Discrepancia (S/):</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="Ej. 5.50 (Sobrante) o -3.20 (Faltante)"
                value={montoArqueo}
                onChange={(e) => setMontoArqueo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Explicación / Nota:</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Describa el motivo del cuadre..."
                value={notaArqueo}
                onChange={(e) => setNotaArqueo(e.target.value)}
                style={{ resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowArqueoModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleRegistrarArqueo} style={{ flex: 1 }}>
                Registrar Arqueo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Tickets del Día */}
      {showTicketsModal && (
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
          <div className="card" style={{ width: "650px", position: "relative", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <button 
              onClick={() => setShowTicketsModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>
              Historial de Tickets - Hoy
            </h3>

            <div className="table-container" style={{ flex: 1, overflowY: "auto" }}>
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>N° Ticket</th>
                    <th>Fecha</th>
                    <th>Vendedor</th>
                    <th>Total</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsDia.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                        Aún no se han procesado tickets el día de hoy.
                      </td>
                    </tr>
                  ) : (
                    ticketsDia.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700 }}>#{t.id}</td>
                        <td>{new Date(t.fecha).toLocaleTimeString()}</td>
                        <td>{t.usuario.nombreVendedor}</td>
                        <td style={{ fontWeight: 700 }}>{formatMoney(t.total)}</td>
                        <td>
                          <button 
                            className="btn btn-outline"
                            onClick={() => generateTicketPDF({
                              ventaId: t.id,
                              total: t.total,
                              pagoCon: t.pagoCon,
                              vuelto: t.vuelto
                            })}
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.8rem",
                            }}
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

            <button 
              className="btn btn-secondary" 
              onClick={() => setShowTicketsModal(false)}
              style={{ marginTop: "20px" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
