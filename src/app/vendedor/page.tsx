"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import {
  Search, ShoppingCart, Receipt, DollarSign,
  Plus, Minus, Trash2, CheckCircle2, X,
  Package, AlertTriangle, Pill, Banknote, Clock,
  Smartphone, Building, QrCode, CreditCard,
  AlertCircle, Info,
} from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatMoney } from "@/lib/format";
import { createClient } from "@supabase/supabase-js";
import { useLocalState } from "@/hooks/useLocalState";
import { AlertManager } from "@/components/AlertProvider";
import CustomSelect from "@/components/CustomSelect";

interface InventarioItem {
  id: number;
  productoId: number;
  sucursalId: number;
  cantidadTotal: number;
  precioCaja: number;
  precioUnidad: number;
  costo: number;
  stockMinimo: number;
  producto: {
    nombreProducto: string;
    nombreComercial?: string | null;
    nombreGenerico?: string | null;
    concentracion?: string | null;
    formaFarmaceuticaRel?: { nombre: string } | null;
    presentacion?: string | null;
    laboratorio?: { nombre: string } | null;
    sku?: string | null;
    codigoBarras?: string | null;
    categorias?: { nombre: string }[];
    cantidadPresentacion: number | null;
    cantidadPresentacionBlister: number | null;
    contenidoNetoValor?: number | null;
    contenidoNetoUnidad?: string | null;
    compuestos?: {
      concentracion: string | null;
      compuesto: { nombre: string };
    }[];
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
    refresh: refreshCart,
  } = useCart();

  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<InventarioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingInventario, setLoadingInventario] = useState<boolean>(true);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(-1);

  const [selectedProduct, setSelectedProduct] = useState<InventarioItem | null>(null);
  useEscapeToClose(!!selectedProduct, useCallback(() => setSelectedProduct(null), []));
  const [tipoVenta, setTipoVenta] = useState<string>("Venta por unidad");
  const [cantidadAñadir, setCantidadAñadir] = useState<number>(1);

  const [pagoCon, setPagoCon] = useState<string>("");
  const [vuelto, setVuelto] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [ultimoCobro, setUltimoCobro] = useState<any>(null);
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [referenciaPago, setReferenciaPago] = useState<string>("");
  const [showPagoConfirmModal, setShowPagoConfirmModal] = useState<boolean>(false);
  const [culqiOrderId, setCulqiOrderId] = useState<string>("");
  const [culqiChargeUrl, setCulqiChargeUrl] = useState<string>("");
  const [culqiQrUrl, setCulqiQrUrl] = useState<string>("");
  const [culqiLoading, setCulqiLoading] = useState<boolean>(false);
  const [culqiPagado, setCulqiPagado] = useState<boolean>(false);
  const [culqiError, setCulqiError] = useState<string>("");
  const [ventaPendienteId, setVentaPendienteId] = useState<number | null>(null);
  const ventaPendienteIdRef = useRef<number | null>(null);
  const [culqiCompletando, setCulqiCompletando] = useState<boolean>(false);
  const [yapeSubMetodo, setYapeSubMetodo] = useState<"directo" | "checkout">("directo");
  const [yapeCelular, setYapeCelular] = useState<string>("");
  const [yapeOtp, setYapeOtp] = useState<string>("");

  const [showArqueoModal, setShowArqueoModal] = useState<boolean>(false);
  useEscapeToClose(showArqueoModal, useCallback(() => setShowArqueoModal(false), []));
  const [montoArqueo, setMontoArqueo] = useState<string>("");
  const [notaArqueo, setNotaArqueo] = useState<string>("");

  const [showTicketsModal, setShowTicketsModal] = useState<boolean>(false);
  useEscapeToClose(showTicketsModal, useCallback(() => setShowTicketsModal(false), []));
  const [ticketsDia, setTicketsDia] = useState<any[]>([]);

  // Panel Ventas del Día
  const [ventasDia, setVentasDia] = useState<any[]>([]);
  const [loadingVentas, setLoadingVentas] = useState<boolean>(true);
  const [ventasFilter, setVentasFilter] = useState("");
  const [showVentas, setShowVentas] = useLocalState("show-ventas-dia", true);
  const [showCart, setShowCart] = useLocalState("show-cart", true);

  const [nombreImpresora, setNombreImpresora] = useState<string>("Etiquetadora");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos-printer-name");
      if (saved) setNombreImpresora(saved);
    }
  }, []);

  const handleSavePrinterName = (name: string) => {
    setNombreImpresora(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos-printer-name", name);
    }
  };

  // Cargar SDK de QZ Tray dinámicamente
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).qz) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js";
      script.async = true;
      script.onload = () => {
        console.log("QZ Tray SDK cargado exitosamente.");
      };
      script.onerror = () => {
        console.error("Error al cargar QZ Tray SDK desde CDN.");
      };
      document.body.appendChild(script);
    }
  }, []);

  const showAlert = (message: string, title = "Alerta", type: 'success' | 'error' | 'warning' | 'info' = 'warning') => {
    AlertManager.show(message, title, type);
  };

  // Redefinimos alert para redirigir los diálogos genéricos al AlertManager
  const alert = (message: string) => {
    AlertManager.show(message, "Notificación", "warning");
  };

  // Pedido de compra
  interface PedidoItem {
    id: string;
    productoId: number | null;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    tipo: "caja" | "unidad" | null;
    esPersonalizado: boolean;
  }
  let pedidoIdCounter = useRef(0);
  const [showPedidoModal, setShowPedidoModal] = useState<boolean>(false);
  const [pedidoSearchQuery, setPedidoSearchQuery] = useState<string>("");

  const [pedidoItems, setPedidoItems] = useState<PedidoItem[]>([]);
  const [pedidoObservaciones, setPedidoObservaciones] = useState<string>("");
  const [pedidoSubmitting, setPedidoSubmitting] = useState<boolean>(false);
  const [pedidoSuccess, setPedidoSuccess] = useState<boolean>(false);
  const [showPedidoSuccessModal, setShowPedidoSuccessModal] = useState<boolean>(false);
  useEscapeToClose(showPedidoSuccessModal, useCallback(() => setShowPedidoSuccessModal(false), []));
  const [pedidoClosing, setPedidoClosing] = useState<boolean>(false);
  const [customNombre, setCustomNombre] = useState("");
  const [customCantidad, setCustomCantidad] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchInventario = useCallback(async () => {
    setLoadingInventario(true);
    try {
      const res = await fetch("/api/inventarios");
      if (res.ok) {
        const data = await res.json();
        setInventario(data);
        // Al iniciar no llenamos productosFiltrados, lo mantenemos vacío
        setProductosFiltrados([]);
      }
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    } finally {
      setLoadingInventario(false);
    }
  }, []);

  const fetchVentasDiaRef = useRef<(() => Promise<void>) | null>(null);
  const handleVentaCompletadaExternamente = useCallback((venta: any) => {
    setUltimoCobro({
      success: true,
      ventaId: venta.id || venta.ventaId,
      total: venta.total,
      metodoPago: venta.metodoPago || "yape",
      referenciaPago: venta.referenciaPago || culqiOrderId,
      detalles: venta.detalles,
    });
    setShowSuccessModal(true);
    setCulqiOrderId("");
    setCulqiChargeUrl("");
    setVentaPendienteId(null);
    ventaPendienteIdRef.current = null;
    setCulqiError("");
    setCulqiPagado(true);
    refreshCart();
    fetchInventario();
    fetchVentasDiaRef.current?.();
  }, [culqiOrderId, refreshCart, fetchInventario]);

  const fetchVentasDia = useCallback(async () => {
    setLoadingVentas(true);
    try {
      // Usar fecha LOCAL (no UTC) para evitar desfase de zona horaria (Peru = UTC-5)
      const ahora = new Date();
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
      const res = await fetch(`/api/ventas?fechaInicio=${hoy}&fechaFin=${hoy}&estado=completado`);
      if (res.ok) {
        const data = await res.json();
        setVentasDia(data);
        setTicketsDia(data);

        // Detectar si la venta pendiente actual se completó (aparece en la lista de completadas)
        const currentPendingId = ventaPendienteIdRef.current;
        if (currentPendingId) {
          const ventaCompletada = data.find((v: any) => v.id === currentPendingId);
          if (ventaCompletada) {
            console.log("Venta pendiente detectada como completada en la lista!");
            handleVentaCompletadaExternamente(ventaCompletada);
          }
        }
      }
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    } finally {
      setLoadingVentas(false);
    }
  }, [handleVentaCompletadaExternamente]);

  fetchVentasDiaRef.current = fetchVentasDia;


  useEffect(() => {
    fetchInventario();
    fetchVentasDia();
    searchInputRef.current?.focus();
  }, [fetchInventario, fetchVentasDia]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    setCulqiError("");
    setYapeCelular("");
    setYapeOtp("");
  }, [metodoPago]);

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
    const handleOpenPedido = () => {
      setShowPedidoModal(true);
      setPedidoSearchQuery("");
      setCustomNombre("");
      setCustomCantidad("");
    };

    window.addEventListener("pos-open-tickets", handleOpenTickets);
    window.addEventListener("pos-open-arqueo", handleOpenArqueo);
    window.addEventListener("pos-open-pedido", handleOpenPedido);

    return () => {
      window.removeEventListener("pos-open-tickets", handleOpenTickets);
      window.removeEventListener("pos-open-arqueo", handleOpenArqueo);
      window.removeEventListener("pos-open-pedido", handleOpenPedido);
    };
  }, [fetchVentasDia]);

  useEffect(() => {
    if (!searchQuery) {
      // Si el buscador está vacío, no se muestra ningún producto
      setProductosFiltrados([]);
    } else {
      const q = searchQuery.toLowerCase();
      setProductosFiltrados(
        inventario.filter(
          (item) =>
            item.producto.nombreProducto.toLowerCase().includes(q) ||
            (item.producto.nombreComercial &&
              item.producto.nombreComercial.toLowerCase().includes(q)) ||
            (item.producto.nombreGenerico &&
              item.producto.nombreGenerico.toLowerCase().includes(q)) ||
            (item.producto.codigoBarras &&
              item.producto.codigoBarras.toLowerCase().includes(q)) ||
            (item.producto.sku &&
              item.producto.sku.toLowerCase().includes(q)) ||
            (item.producto.categorias?.[0]?.nombre &&
              item.producto.categorias[0].nombre.toLowerCase().includes(q))
        )
      );
    }
  }, [searchQuery, inventario]);

  // Manejar índice seleccionado cuando cambian los productos filtrados
  useEffect(() => {
    if (productosFiltrados.length > 0) {
      setSelectedProductIndex(0);
    } else {
      setSelectedProductIndex(-1);
    }
  }, [productosFiltrados]);

  // Desplazar automáticamente la fila seleccionada por teclado
  useEffect(() => {
    if (selectedProductIndex >= 0) {
      const activeRow = document.querySelector(".pos-row-active");
      if (activeRow) {
        activeRow.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [selectedProductIndex]);



  const subtotal = getSubtotal();
  const totalVendioHoy = ventasDia.reduce((acc, t) => acc + (t.total || 0), 0);
  const ventasFiltradas = ventasFilter
    ? ventasDia.filter((v) => {
        const q = ventasFilter.toLowerCase();
        if (`${v.id}`.includes(q)) return true;
        if (v.detalles?.some((d: any) => d.nombreProducto?.toLowerCase().includes(q))) return true;
        return false;
      })
    : ventasDia;
  useEffect(() => {
    const pago = parseFloat(pagoCon) || 0;
    setVuelto(pago >= subtotal && subtotal > 0 ? pago - subtotal : 0);
  }, [pagoCon, subtotal]);

  const getUnidadesEnCarrito = (productoId: number) => {
    return cartItems
      .filter((item) => item.productoId === productoId)
      .reduce((acc, item) => {
        let factor = 1;
        if (item.tipoVenta === "Venta por caja") {
          factor = item.producto.cantidadPresentacion || 1;
        } else if (item.tipoVenta === "Venta por blíster") {
          factor = item.producto.cantidadPresentacionBlister || 1;
        }
        return acc + item.cantidad * factor;
      }, 0);
  };

  const getMaxQtyAñadir = () => {
    if (!selectedProduct) return 0;
    const unidadesEnCarrito = getUnidadesEnCarrito(selectedProduct.productoId);
    const disponibles = Math.max(0, selectedProduct.cantidadTotal - unidadesEnCarrito);

    if (tipoVenta === "Venta por caja") {
      const fc = selectedProduct.producto.cantidadPresentacion || 1;
      return Math.floor(disponibles / fc);
    } else if (tipoVenta === "Venta por blíster") {
      const fb = selectedProduct.producto.cantidadPresentacionBlister || 1;
      return Math.floor(disponibles / fb);
    } else {
      return disponibles;
    }
  };

  const handleSelectTipoVenta = (tipo: string) => {
    setTipoVenta(tipo);
    if (!selectedProduct) return;
    let factor = 1;
    if (tipo === "Venta por caja") {
      factor = selectedProduct.producto.cantidadPresentacion || 1;
    } else if (tipo === "Venta por blíster") {
      factor = selectedProduct.producto.cantidadPresentacionBlister || 1;
    }
    const disponibles = Math.max(0, selectedProduct.cantidadTotal - getUnidadesEnCarrito(selectedProduct.productoId));
    const maxForNewTipo = Math.floor(disponibles / factor);
    setCantidadAñadir(maxForNewTipo > 0 ? 1 : 0);
  };

  const handleOpenAddModal = (item: InventarioItem) => {
    setSelectedProduct(item);
    setTipoVenta("Venta por unidad");
    const disponibles = Math.max(0, item.cantidadTotal - getUnidadesEnCarrito(item.productoId));
    setCantidadAñadir(disponibles > 0 ? 1 : 0);
  };

  const handleConfirmAdd = async () => {
    if (!selectedProduct) return;
    const maxQty = getMaxQtyAñadir();
    if (cantidadAñadir > maxQty) {
      alert(`No se puede agregar esa cantidad. Stock máximo disponible en este formato: ${maxQty}`);
      return;
    }
    if (cantidadAñadir <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }

    let precio = selectedProduct.precioUnidad;
    if (tipoVenta === "Venta por caja") {
      precio = selectedProduct.precioCaja;
    } else if (tipoVenta === "Venta por blíster") {
      const fb = selectedProduct.producto.cantidadPresentacionBlister || 10;
      const fc = selectedProduct.producto.cantidadPresentacion || 100;
      precio = (selectedProduct.precioCaja / fc) * fb;
    }
    const prodId = selectedProduct.productoId;
    const qty = cantidadAñadir;
    const itemType = tipoVenta;

    // Cerrar modal y enfocar buscador de forma inmediata (Optimistic UI)
    setSelectedProduct(null);
    // Mantenemos la búsqueda anterior y colocamos el cursor al final del texto para seguir escribiendo
    setTimeout(() => {
      if (searchInputRef.current) {
        const input = searchInputRef.current;
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 50);

    // Realizar la adición en segundo plano
    addToCart(prodId, qty, precio, itemType).then((res) => {
      if (res && !res.success) {
        showAlert(res.error || "Error al agregar producto", "Error de Inventario", "error");
      }
    });
  };

  const handleCartIncrement = (item: any) => {
    const invItem = inventario.find((inv) => inv.productoId === item.productoId);
    if (!invItem) return;

    const unidadesOtros = cartItems
      .filter((c) => c.productoId === item.productoId && c.id !== item.id)
      .reduce((acc, c) => {
        let f = 1;
        if (c.tipoVenta === "Venta por caja") {
          f = c.producto.cantidadPresentacion || 1;
        } else if (c.tipoVenta === "Venta por blíster") {
          f = c.producto.cantidadPresentacionBlister || 1;
        }
        return acc + c.cantidad * f;
      }, 0);

    let factor = 1;
    if (item.tipoVenta === "Venta por caja") {
      factor = item.producto.cantidadPresentacion || 1;
    } else if (item.tipoVenta === "Venta por blíster") {
      factor = item.producto.cantidadPresentacionBlister || 1;
    }

    const disponiblesUnidades = Math.max(0, invItem.cantidadTotal - unidadesOtros);
    const maxQtyParaEsteItem = Math.floor(disponiblesUnidades / factor);

    if (item.cantidad + 1 > maxQtyParaEsteItem) {
      alert(`No es posible agregar más. Solo quedan ${maxQtyParaEsteItem} disponibles en este formato.`);
      return;
    }

    updateQuantity(item.id, item.cantidad + 1);
  };

  const handleCobrar = async () => {
    if (subtotal <= 0) return;
    if (metodoPago === "transferencia") {
      setShowPagoConfirmModal(true);
      return;
    }
    if (metodoPago === "yape") {
      await generarPagoCulqi();
      return;
    }
    const pago = parseFloat(pagoCon) || 0;
    if (pago < subtotal) { alert("El monto de pago es insuficiente"); return; }
    await procesarCobro(pago);
  };

  const procesarCobro = async (pago: number, ref?: string) => {
    const itemsParaTicket = [...cartItems];
    const res = await checkout(pago, vuelto, metodoPago, ref || referenciaPago);
    if (res.success) {
      setUltimoCobro({
        ...res,
        items: itemsParaTicket
      });
      setShowSuccessModal(true);
      setPagoCon("");
      setVuelto(0);
      setReferenciaPago("");
      setShowPagoConfirmModal(false);
      setCulqiOrderId("");
      setCulqiChargeUrl("");
      setCulqiQrUrl("");
      setCulqiPagado(false);
      setCulqiError("");
      setVentaPendienteId(null);
      ventaPendienteIdRef.current = null;
      setCulqiCompletando(false);
      fetchInventario();
      fetchVentasDia();
    } else {
      showAlert(`Error al procesar cobro: ${res.error}`, "Error de Cobro", "error");
    }
  };

  const imprimirTicketYape = (orderId: string, chargeUrl: string, monto: number, apiQrUrl?: string) => {
    const qrUrl = apiQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(chargeUrl)}`;
    const ticket = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ticket de pago</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  body { font-family: 'Helvetica', Arial, sans-serif; width: 72mm; margin: 0 auto; padding: 8px 0; text-align: center; font-size: 12px; color: #000; }
  h2 { font-size: 16px; margin: 8px 0; }
  .total { font-size: 22px; font-weight: bold; margin: 8px 0; }
  .qr { margin: 12px 0; }
  .info { margin: 4px 0; color: #555; font-size: 10px; word-break: break-all; }
  hr { border: none; border-top: 1px dashed #999; margin: 12px 0; }
</style></head><body>
  <h2>Pago Digital (Culqi)</h2>
  <p>Escanea el código QR para pagar</p>
  <div class="total">S/ ${monto.toFixed(2)}</div>
  <div class="qr"><img src="${qrUrl}" width="200" height="200" alt="QR" /></div>
  <hr>
  <div class="info">Orden: ${orderId}</div>
  <div class="info">Válido por 1 hora</div>
  <p style="margin-top: 12px; font-size: 10px;">PharmaSalud S.A.C.</p>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(ticket);
      win.document.close();
      setTimeout(() => { try { win.print(); } catch {} }, 500);
    }
  };

  const generarPagoCulqi = async () => {
    setCulqiLoading(true);
    setCulqiError("");
    setCulqiPagado(false);
    setVentaPendienteId(null);
    ventaPendienteIdRef.current = null;
    try {
      // 1. Crear orden Culqi
      const resPago = await fetch("/api/pagos/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: subtotal,
          descripcion: `Venta POS - Farmacia`,
        }),
      });
      const dataPago = await resPago.json();
      if (!resPago.ok) throw new Error(dataPago.error);
      const { orderId, chargeUrl, qrUrl, publicKey, rsaId, rsaPublicKey } = dataPago;

      // 2. Crear venta pendiente (sin descontar stock)
      const resVenta = await fetch("/api/carrito/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagoCon: subtotal,
          vuelto: 0,
          metodoPago: "yape",
          referenciaPago: orderId,
          pendiente: true,
        }),
      });
      const dataVenta = await resVenta.json();
      if (!resVenta.ok) throw new Error(dataVenta.error);

      setCulqiOrderId(orderId);
      setCulqiChargeUrl(chargeUrl);
      setCulqiQrUrl(qrUrl || "");
      setVentaPendienteId(dataVenta.ventaId);
      ventaPendienteIdRef.current = dataVenta.ventaId;

      // 3. Intentar abrir Culqi Checkout modal (no bloquea el flujo)
      if (publicKey) {
        abrirCulqiCheckout(publicKey, orderId, subtotal, rsaId, rsaPublicKey);
      }

      // 4. Imprimir ticket con QR como respaldo
      setTimeout(() => imprimirTicketYape(orderId, chargeUrl, subtotal, qrUrl), 300);
    } catch (err: any) {
      setCulqiError(err.message);
    } finally {
      setCulqiLoading(false);
    }
  };

  const handlePagarYapeDirecto = async () => {
    if (!yapeCelular || yapeCelular.length !== 9) {
      setCulqiError("El número de celular debe tener exactamente 9 dígitos");
      return;
    }
    if (!yapeOtp || yapeOtp.length !== 6) {
      setCulqiError("El código de aprobación OTP debe tener exactamente 6 dígitos");
      return;
    }

    setCulqiLoading(true);
    setCulqiError("");
    setCulqiPagado(false);
    setVentaPendienteId(null);
    ventaPendienteIdRef.current = null;

    try {
      // 1. Crear venta pendiente (sin descontar stock)
      const tempRef = `YAPE-DIR-${Date.now()}`;
      const resVenta = await fetch("/api/carrito/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagoCon: subtotal,
          vuelto: 0,
          metodoPago: "yape",
          referenciaPago: tempRef,
          pendiente: true,
        }),
      });

      const dataVenta = await resVenta.json();
      if (!resVenta.ok) throw new Error(dataVenta.error || "No se pudo registrar la venta pendiente.");

      const ventaId = dataVenta.ventaId;
      setVentaPendienteId(ventaId);
      ventaPendienteIdRef.current = ventaId;

      // 2. Procesar el pago directo con Yape
      const resYape = await fetch("/api/pagos/yape-directo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ventaId: ventaId,
          number_phone: yapeCelular,
          otp: yapeOtp,
        }),
      });

      const dataYape = await resYape.json();
      if (!resYape.ok) throw new Error(dataYape.error || "Error al procesar el cobro Yape.");

      // 3. Completar flujo
      handleVentaCompletadaExternamente({
        id: ventaId,
        total: subtotal,
        metodoPago: "yape",
        referenciaPago: dataYape.chargeId,
      });

      // Limpiar campos de Yape
      setYapeCelular("");
      setYapeOtp("");

    } catch (err: any) {
      setCulqiError(err.message);
    } finally {
      setCulqiLoading(false);
    }
  };

  const abrirCulqiCheckout = async (publicKey: string, orderId: string, monto: number, rsaId?: string | null, rsaPublicKey?: string | null) => {
    return new Promise<void>((resolve) => {
      const scriptId = "culqi-checkout-js";
      const initCheckout = () => {
        try {
          const settings: Record<string, any> = {
            title: "PharmaSalud",
            currency: "PEN",
            amount: Math.round(monto * 100),
            order: orderId,
          };
          if (rsaId && rsaPublicKey) {
            settings.xculqirsaid = rsaId;
            settings.rsapublickey = rsaPublicKey;
          }
          const client = { email: "pos@farmacia.com" };
          const paymentMethods = { tarjeta: true, yape: true, billetera: true, bancaMovil: true, agente: true, cuotealo: false };
          const options = {
            lang: "auto",
            installments: false,
            modal: true,
            paymentMethods,
            paymentMethodsSort: Object.keys(paymentMethods),
          };
          const config = { settings, client, options };
          const Culqi = new (window as any).CulqiCheckout(publicKey, config);
          Culqi.culqi = () => {
            console.log("Culqi callback", { order: !!Culqi.order, token: !!Culqi.token, error: !!Culqi.error, orderData: Culqi.order });
            if (Culqi.order) {
              Culqi.close();
              completarVentaPendiente();
              resolve();
            } else if (Culqi.error) {
              const err = Culqi.error;
              setCulqiError(err.user_message || err.merchant_message || "Error en el pago");
              resolve();
            }
          };
          Culqi.open();
        } catch (e: any) {
          console.warn("Culqi Checkout no disponible, usando QR:", e.message);
          resolve();
        }
      };
      if (document.getElementById(scriptId)) {
        initCheckout();
        return;
      }
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://js.culqi.com/checkout-js";
      script.onload = initCheckout;
      script.onerror = () => {
        console.warn("No se pudo cargar Culqi Checkout JS, usando QR");
        resolve();
      };
      document.body.appendChild(script);
    });
  };

  const completarVentaPendiente = async () => {
    const id = ventaPendienteIdRef.current;
    if (!id) return;
    setCulqiCompletando(true);
    try {
      const res = await fetch(`/api/ventas/${id}/completar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Llamar a la función común para limpiar el estado y mostrar éxito
      handleVentaCompletadaExternamente({
        id,
        total: subtotal,
        metodoPago: "yape",
        referenciaPago: culqiOrderId,
      });
    } catch (err: any) {
      setCulqiError(err.message);
    } finally {
      setCulqiCompletando(false);
    }
  };

  const verificarPagoCulqi = async () => {
    if (!culqiOrderId || !ventaPendienteId) return;
    setCulqiLoading(true);
    setCulqiError("");
    try {
      const res = await fetch("/api/pagos/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: culqiOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.pagado) {
        await completarVentaPendiente();
      } else {
        setCulqiError("El pago aún no ha sido confirmado");
      }
    } catch (err: any) {
      setCulqiError(err.message);
    } finally {
      setCulqiLoading(false);
    }
  };

  const pedidoSearchResults = pedidoSearchQuery
    ? inventario.filter(
        (item) =>
          item.producto.nombreProducto.toLowerCase().includes(pedidoSearchQuery.toLowerCase())
      )
    : [];

  const handleAddPedidoItem = (item: InventarioItem) => {
    const id = (++pedidoIdCounter.current).toString();
    setPedidoItems((prev) => [
      ...prev,
      {
        id,
        productoId: item.productoId,
        nombre: item.producto.nombreProducto,
        cantidad: 1,
        precioUnitario: 0,
        subtotal: 0,
        tipo: null,
        esPersonalizado: false,
      },
    ]);
  };

  const handleAddCustomItem = () => {
    const nombre = customNombre.trim();
    const cantidad = parseInt(customCantidad, 10);
    if (!nombre) { alert("Ingrese el nombre del producto"); return; }
    if (!cantidad || cantidad < 1) { alert("Ingrese una cantidad válida"); return; }
    const id = (++pedidoIdCounter.current).toString();
    setPedidoItems((prev) => [
      ...prev,
      {
        id,
        productoId: null,
        nombre,
        cantidad,
        precioUnitario: 0,
        subtotal: 0,
        tipo: null,
        esPersonalizado: true,
      },
    ]);
    setCustomNombre("");
    setCustomCantidad("");
  };

  const handleRemovePedidoItem = (id: string) => {
    setPedidoItems((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdatePedidoCantidad = (id: string, cantidad: number) => {
    if (cantidad < 1) return;
    setPedidoItems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, cantidad, subtotal: cantidad * p.precioUnitario } : p
      )
    );
  };

  const handleClosePedido = () => {
    setPedidoClosing(true);
    setTimeout(() => {
      setShowPedidoModal(false);
      setPedidoClosing(false);
      setPedidoSuccess(false);
    }, 350);
  };

  const handleSubmitPedido = async () => {
    if (pedidoItems.length === 0) {
      alert("Agregue al menos un producto");
      return;
    }
    const itemsConProducto = pedidoItems.filter((p) => p.productoId !== null);
    if (itemsConProducto.length === 0) {
      alert("No se puede registrar un pedido con solo productos personalizados");
      return;
    }
    setPedidoSubmitting(true);
    try {
      const res = await fetch("/api/compras/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detalles: itemsConProducto.map((p) => ({
            productoId: p.productoId,
            cantidad: p.cantidad,
            precioUnitario: p.precioUnitario,
          })),
          observaciones: pedidoObservaciones || undefined,
        }),
      });
      if (res.ok) {
        setPedidoItems([]);
        setPedidoSearchQuery("");
        setPedidoObservaciones("");
        setCustomNombre("");
        setCustomCantidad("");
        pedidoIdCounter.current = 0;
        setPedidoSuccess(true);
        handleClosePedido();
        setTimeout(() => setShowPedidoSuccessModal(true), 400);
      } else {
        const err = await res.json();
        showAlert(`Error: ${err.error}`, "Error de Registro", "error");
      }
    } catch (error) {
      console.error("Error al crear pedido:", error);
      showAlert("Error al crear la orden de compra", "Error de Transacción", "error");
    } finally {
      setPedidoSubmitting(false);
    }
  };

  const handleRegistrarArqueo = async () => {
    const monto = parseFloat(montoArqueo);
    if (isNaN(monto)) { showAlert("Ingrese un monto de arqueo válido", "Valor Incorrecto", "warning"); return; }
    try {
      const res = await fetch("/api/sobrante-caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, nota: notaArqueo }),
      });
      if (res.ok) {
        showAlert("El arqueo de caja se registró con éxito.", "Registro de Arqueo", "success");
        setShowArqueoModal(false);
        setMontoArqueo("");
        setNotaArqueo("");
      } else {
        showAlert("Error al registrar el arqueo en el servidor.", "Error de Arqueo", "error");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const cleanText = (text: string) => {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remueve tildes
      .replace(/[^ -~\n]/g, "") // Solo ASCII imprimible + salto de línea
      .toUpperCase();
  };

  const generarComandosEscPos = (venta: any) => {
    const sucursalNombre = (venta.sucursal?.nombre || "AV. LARCO 456, TRUJILLO").toUpperCase();
    const vendedorStr = (venta.usuario?.nombreVendedor || "").toUpperCase();
    const fecha = venta.fecha ? new Date(venta.fecha) : new Date();
    const fechaStr = fecha.toLocaleString();
    const total = (venta.total || 0).toFixed(2);
    const pagoCon = (venta.pagoCon || 0).toFixed(2);
    const vuelto = (venta.vuelto || 0).toFixed(2);

    const items = venta.detalles || venta.items || (venta.productosIds ? null : (cartItems.length > 0 ? cartItems : null));

    // Comandos ESC/POS
    const INIT = "\x1B\x40";
    const FONT_A = "\x1B\x21\x00";
    const SELECT_FONT_A = "\x1B\x4D\x00";
    const ALIGN_CENTER = "\x1B\x61\x01";
    const ALIGN_LEFT = "\x1B\x61\x00";

    const data: any[] = [];
    data.push(INIT);
    data.push(FONT_A);
    data.push(SELECT_FONT_A);

    // Abrir cajón monedero si el pago fue en efectivo y hay vuelto
    if (venta.metodoPago === "efectivo" && (venta.vuelto || 0) > 0) {
      data.push("\x1B\x70\x00\x19\xFA");
    }

    // Encabezado
    data.push(ALIGN_CENTER);
    data.push("BOTICA PHARMA SALUD\n");
    data.push("RUC: 10427847118\n");
    data.push(`${cleanText(sucursalNombre)}\n`);
    data.push("------------------------------------------------\n");

    // Datos de Venta
    data.push(ALIGN_LEFT);
    data.push(`TICKET N°: 0000${venta.ventaId || venta.id}\n`);
    data.push(`FECHA: ${fechaStr}\n`);
    if (vendedorStr) {
      data.push(`VEND: ${cleanText(vendedorStr)}\n`);
    }
    data.push("------------------------------------------------\n");
    data.push("CANT  DESCRIPCION                        IMPORTE\n");
    data.push("------------------------------------------------\n");

    // Items
    if (items && items.length > 0) {
      items.forEach((item: any) => {
        const nombreProd = item.nombreProducto || item.producto?.nombreProducto || "PRODUCTO";
        const desc = nombreProd.substring(0, 26);
        const sub = (item.cantidad * (item.precioVenta || item.precioVentaUnitario || 0)).toFixed(2);
        
        const cantCol = item.cantidad.toString().padEnd(4);
        const descCol = cleanText(desc).padEnd(26);
        const subCol = `S/ ${sub}`.padStart(14);
        
        data.push(`${cantCol}  ${descCol}  ${subCol}\n`);
      });
    } else {
      data.push("       PRODUCTOS PROCESADOS EN VENTA\n");
    }

    data.push("------------------------------------------------\n");

    // Totales
    const totalLine = `TOTAL:`.padEnd(24) + `S/ ${total}`.padStart(24);
    const recibidoLine = `RECIBIDO:`.padEnd(24) + `S/ ${pagoCon}`.padStart(24);
    const cambioLine = `CAMBIO:`.padEnd(24) + `S/ ${vuelto}`.padStart(24);

    data.push(`${totalLine}\n`);
    data.push(`${recibidoLine}\n`);
    data.push(`${cambioLine}\n`);
    data.push("------------------------------------------------\n");

    // Footer
    data.push(ALIGN_CENTER);
    const copiaStr = (venta.ventaId || venta.id) ? "" : "TICKET PROVISIONAL\n";
    data.push("GRACIAS POR SU PREFERENCIA\n");
    data.push("VUELVA PRONTO\n");
    if (copiaStr) {
      data.push(`\n${copiaStr}`);
    }

    // Corte de papel
    data.push("\n\n\n\n\n");
    data.push("\x1D\x56\x42\x00"); // Corte parcial (GS V 66)

    return data;
  };

  const imprimirTicketQZ = async (venta: any) => {
    const qz = (window as any).qz;
    if (!qz) {
      showAlert("El SDK de QZ Tray no se ha cargado. Por favor recargue la página.", "Error de QZ Tray", "error");
      return;
    }

    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }

      const config = qz.configs.create(nombreImpresora, { forceRaw: true });
      const rawData = generarComandosEscPos(venta);
      
      await qz.print(config, rawData);
      showAlert("Imprimiendo ticket nativo...", "Éxito de Impresión", "success");
    } catch (err: any) {
      console.error("Error al imprimir con QZ Tray:", err);
      showAlert(
        `Error al imprimir por QZ Tray. Asegúrese de que QZ Tray esté abierto y que la impresora se llame '${nombreImpresora}'.\nDetalle: ${err.message || err}`,
        "Error de QZ Tray",
        "error"
      );
    }
  };

  const imprimirTicketHTML = (venta: any) => {
    const sucursalNombre = venta.sucursal?.nombre || "AV. LARCO 456, TRUJILLO";
    const vendedorStr = venta.usuario?.nombreVendedor || "";
    const fecha = venta.fecha ? new Date(venta.fecha) : new Date();
    const fechaStr = fecha.toLocaleString();
    const total = (venta.total || 0).toFixed(2);
    const pagoCon = (venta.pagoCon || 0).toFixed(2);
    const vuelto = (venta.vuelto || 0).toFixed(2);

    const items = venta.detalles || venta.items || (venta.productosIds ? null : (cartItems.length > 0 ? cartItems : null));

    let itemsText = "";
    if (items && items.length > 0) {
      items.forEach((item: any) => {
        const nombreProd = item.nombreProducto || item.producto?.nombreProducto || "PRODUCTO";
        const desc = nombreProd.substring(0, 26);
        const sub = (item.cantidad * (item.precioVenta || item.precioVentaUnitario || 0)).toFixed(2);
        
        const cantCol = item.cantidad.toString().padEnd(4);
        const descCol = desc.padEnd(26);
        const subCol = `S/ ${sub}`.padStart(14);
        
        itemsText += `${cantCol}  ${descCol}  ${subCol}\n`;
      });
    } else {
      itemsText = "       PRODUCTOS PROCESADOS EN VENTA\n";
    }

    const copiaStr = venta.ventaId || venta.id ? "" : "TICKET PROVISIONAL\n";

    // Generar la cadena de texto plano alineada a 48 caracteres
    let text = "";
    text += "              BOTICA PHARMA SALUD\n";
    text += "                RUC: 10427847118\n";
    
    // Centrar la sucursal (máximo 48 caracteres)
    const sucursalCentrada = sucursalNombre.substring(0, 48);
    const padSucursal = Math.max(0, Math.floor((48 - sucursalCentrada.length) / 2));
    text += " ".repeat(padSucursal) + sucursalCentrada + "\n";
    
    text += "------------------------------------------------\n";
    text += `TICKET N°: 0000${venta.ventaId || venta.id}\n`;
    text += `FECHA: ${fechaStr}\n`;
    if (vendedorStr) {
      text += `VEND: ${vendedorStr}\n`;
    }
    text += "------------------------------------------------\n";
    text += "CANT  DESCRIPCION                        IMPORTE\n";
    text += "------------------------------------------------\n";
    text += itemsText;
    text += "------------------------------------------------\n";
    
    const totalLine = `TOTAL:`.padEnd(24) + `S/ ${total}`.padStart(24);
    const recibidoLine = `RECIBIDO:`.padEnd(24) + `S/ ${pagoCon}`.padStart(24);
    const cambioLine = `CAMBIO:`.padEnd(24) + `S/ ${vuelto}`.padStart(24);
    
    text += `${totalLine}\n`;
    text += `${recibidoLine}\n`;
    text += `${cambioLine}\n`;
    text += "------------------------------------------------\n";
    text += "           GRACIAS POR SU PREFERENCIA\n";
    text += "                 VUELVA PRONTO\n";
    if (copiaStr) {
      text += `\n       ${copiaStr}`;
    }

    // Convertir todo a MAYÚSCULAS para mayor legibilidad en Font A
    text = text.toUpperCase();

    // Escribir en una ventana limpia como solo texto
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><body><pre style="margin: 0; padding: 0;">${text}</pre></body></html>`);
      win.document.close();
      win.print();
      setTimeout(() => { win.close(); }, 500);
    }
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

  // Manejar navegación por teclado en el buscador de productos (arriba, abajo, Enter, Escape)
  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchQuery("");
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      // Intentar coincidencia exacta de código de barras o SKU
      const exactMatch = inventario.find(
        (item) =>
          (item.producto.codigoBarras && item.producto.codigoBarras.toLowerCase() === q) ||
          (item.producto.sku && item.producto.sku.toLowerCase() === q)
      );

      if (exactMatch) {
        const disponibles = Math.max(0, exactMatch.cantidadTotal - getUnidadesEnCarrito(exactMatch.productoId));
        if (disponibles > 0) {
          // Verificar si tiene formatos de caja o blíster habilitados
          const tieneCaja = exactMatch.precioCaja > 0 && exactMatch.producto.categorias?.[0]?.nombre?.toLowerCase() !== "unidad";
          const tieneBlister = exactMatch.producto.cantidadPresentacionBlister && exactMatch.producto.categorias?.[0]?.nombre?.toLowerCase() !== "unidad";

          if (tieneCaja || tieneBlister) {
            // Abrir el modal del producto seleccionado para que el vendedor escoja el formato
            handleOpenAddModal(exactMatch);
            setSearchQuery(""); // Limpiar buscador para la siguiente acción
          } else {
            // Seguir normal cuando es solo unidad (agregar 1 unidad directamente)
            addToCart(exactMatch.productoId, 1, exactMatch.precioUnidad, "Venta por unidad").then((res) => {
              if (res && res.success) {
                setSearchQuery(""); // Limpiar buscador para el siguiente escaneo
              } else {
                showAlert(res?.error || "Error al agregar producto", "Error de Inventario", "error");
              }
            });
          }
        } else {
          showAlert("No hay suficiente stock disponible para este producto.", "Sin Stock", "warning");
        }
        return;
      }
    }

    if (productosFiltrados.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedProductIndex((prev) =>
        prev < productosFiltrados.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedProductIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedProductIndex >= 0 && selectedProductIndex < productosFiltrados.length) {
        const item = productosFiltrados[selectedProductIndex];
        const sinStock = item.cantidadTotal <= 0;
        if (!sinStock) {
          handleOpenAddModal(item);
        }
      }
    }
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
                onKeyDown={handleSearchInputKeyDown}
              />
              <div className="pos-search-actions">
                {searchQuery && (
                  <button className="pos-search-clear" onClick={() => setSearchQuery("")} title="Limpiar búsqueda [Esc]">
                    <X size={15} strokeWidth={2} />
                  </button>
                )}
                <div className="pos-search-badge">
                  F1
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
                    <th style={{ width: "46%", textAlign: "left" }}>Medicamento</th>
                    <th style={{ width: "8%", textAlign: "right" }}>S. Caja</th>
                    <th style={{ width: "8%", textAlign: "right" }}>S. Und.</th>
                    <th style={{ width: "12%", textAlign: "right" }}>P. Caja</th>
                    <th style={{ width: "13%", textAlign: "right" }}>P. Blíster</th>
                    <th style={{ width: "13%", textAlign: "right" }}>P. Und.</th>
                  </tr>
                </thead>

                <tbody>
                  {!searchQuery ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="pos-empty" style={{ padding: "64px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#64748b" }}>
                          <div style={{
                            padding: "16px",
                            borderRadius: "50%",
                            background: "rgba(225, 29, 72, 0.05)",
                            color: "#e11d48",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <Search size={32} strokeWidth={1.5} />
                          </div>
                          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Buscador de Productos</h3>
                          <p style={{ fontSize: "0.82rem", margin: 0, color: "#64748b", textAlign: "center", maxWidth: "340px", lineHeight: 1.45 }}>
                            Escribe en el buscador superior o escanea un código de barras para ver los productos disponibles.
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "0.75rem", background: "#f8fafc", padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(15, 23, 42, 0.05)" }}>
                            <span style={{ color: "#64748b" }}>Presiona</span>
                            <kbd style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "1px 5px", fontSize: "0.7rem", fontWeight: 600, fontFamily: "monospace", color: "#0f172a", boxShadow: "0 1px 1px rgba(0,0,0,0.05)" }}>F1</kbd>
                            <span style={{ color: "#64748b" }}>para enfocar el buscador.</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="pos-empty">
                          <Package size={36} strokeWidth={1} />
                          <p>No se encontraron medicamentos para "{searchQuery}"</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    productosFiltrados.map((item, index) => {
                      const fc = item.producto.cantidadPresentacion || 1;
                      const cajas = Math.floor(item.cantidadTotal / fc);
                      const unds = item.cantidadTotal % fc;
                      const bajo = item.cantidadTotal <= item.stockMinimo;
                      const sinStock = item.cantidadTotal <= 0;
                      const esUnidad = item.producto.categorias?.[0]?.nombre?.toLowerCase() === "unidad";
                      const precioBlister = esUnidad !== true ? item.precioBlister : null;

                      return (
                        <tr 
                          key={item.id} 
                          className={`${sinStock ? "pos-row-disabled" : ""} ${index === selectedProductIndex ? "pos-row-active" : ""}`}
                          onClick={() => !sinStock && handleOpenAddModal(item)}
                        >
                          <td style={{ width: "46%" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                              {(() => {
                                const comps = item.producto.compuestos;
                                const tieneComercial = !!item.producto.nombreComercial;
                                const nombrePrincipal = tieneComercial
                                  ? item.producto.nombreComercial
                                  : comps && comps.length > 0
                                    ? `${comps[0].compuesto.nombre}${comps[0].concentracion ? ` ${comps[0].concentracion}` : ""}`
                                    : item.producto.nombreGenerico || "";
                                const mostrarComposicion = comps && comps.length > 0 && (!tieneComercial || comps.length > 1);
                                return (
                                  <>
                                    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#0f172a", lineHeight: 1.3, display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                                      {nombrePrincipal}
                                      <span style={{ fontSize: "0.85rem", color: "#64748b", display: "inline-flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                                        <span style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>
                                          {item.producto.formaFarmaceuticaRel?.nombre || "GENERAL"}
                                          {item.producto.contenidoNetoValor != null ? ` ${item.producto.contenidoNetoValor}${item.producto.contenidoNetoUnidad || ""}` : ""}
                                        </span>
                                        <span style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>{item.producto.laboratorio?.nombre || "—"}</span>
                                      </span>
                                    </span>
                                    {(item.producto.presentacion === "Caja") && (
                                      <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
                                        <span>Caja x {item.producto.cantidadPresentacion || 100}</span>
                                        {item.producto.cantidadPresentacionBlister && item.producto.cantidadPresentacionBlister > 1 && (
                                          <span>· Blister x {item.producto.cantidadPresentacionBlister}</span>
                                        )}
                                      </span>
                                    )}
                                    {mostrarComposicion && (
                                      <span style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.3 }}>
                                        {comps.map(c => `${c.compuesto.nombre}${c.concentracion ? ` ${c.concentracion}` : ""}`).join(" + ")}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td style={{ width: "8%", textAlign: "right" }}>
                            {esUnidad ? "--" : (sinStock ? 0 : cajas)}
                          </td>
                          <td style={{ width: "8%", textAlign: "right" }}>
                            {sinStock ? 0 : unds}
                          </td>
                          <td style={{ width: "12%", textAlign: "right" }} className="pos-td-price">
                            {esUnidad ? "--" : formatMoney(item.precioCaja)}
                          </td>
                          <td style={{ width: "13%", textAlign: "right" }} className="pos-td-price">
                            {precioBlister ? formatMoney(precioBlister) : "--"}
                          </td>
                          <td style={{ width: "13%", textAlign: "right" }} className="pos-td-price">
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
                <Clock size={16} strokeWidth={1.75} style={{ color: "#e11d48" }} />
                Ventas del Día
                <span className="pos-ventas-badge">{ventasFilter ? `${ventasFiltradas.length}/${ventasDia.length}` : ventasDia.length}</span>
              </div>
              <p className="pos-ventas-hero-total">{formatMoney(totalVendioHoy)}</p>
              <p className="pos-ventas-hero-sub">TOTAL RECAUDADO HOY</p>
            </div>

            {/* Filtro */}
            <div className="pos-ventas-filter">
              <Search size={15} strokeWidth={1.75} className="pos-ventas-filter-icon" />
              <input
                type="text"
                className="pos-ventas-filter-input"
                placeholder="Filtrar por ticket o producto..."
                value={ventasFilter}
                onChange={(e) => setVentasFilter(e.target.value)}
              />
              {ventasFilter && (
                <button className="pos-ventas-filter-clear" onClick={() => setVentasFilter("")}>
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Lista de Ventas */}
            <div className="pos-ventas-items">
              {loadingVentas ? (
                <div className="pos-ventas-loading">
                  <span className="pos-spinner" style={{ borderColor: "rgba(225,29,72,.3)", borderTopColor: "#e11d48" }} />
                  <p>Cargando ventas...</p>
                </div>
              ) : ventasDia.length === 0 ? (
                <div className="pos-ventas-empty">
                  <Clock size={40} strokeWidth={1} />
                  <p>Sin ventas hoy</p>
                  <small>Las ventas finalizadas aparecerán aquí</small>
                </div>
              ) : ventasFiltradas.length === 0 ? (
                <div className="pos-ventas-empty">
                  <Search size={36} strokeWidth={1} />
                  <p>Sin resultados</p>
                  <small>Ninguna venta coincide con el filtro</small>
                </div>
              ) : (
                ventasFiltradas.map((venta) => (
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
                        onClick={() => imprimirTicketQZ(venta)}
                        title="Reimprimir ticket con QZ Tray"
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                      <span className="pos-cart-item-name">
                        {item.producto.nombreGenerico || item.producto.nombreComercial ? (
                          <>
                            {item.producto.nombreComercial || item.producto.nombreGenerico}
                            {item.producto.concentracion && ` ${item.producto.concentracion}`}
                          </>
                        ) : (
                          item.producto.nombreProducto
                        )}
                      </span>
                      <div className="pos-qty-ctrl">
                        <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.cantidad - 1)}>
                          <Minus size={10} strokeWidth={2.5} />
                        </button>
                        <span className="pos-qty-val">{item.cantidad}</span>
                        <button className="pos-qty-btn" onClick={() => handleCartIncrement(item)}>
                          <Plus size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                    <div className="pos-cart-item-info">
                      <div className="pos-cart-item-tags">
                        <span className="pos-cart-tag">{item.tipoVenta.replace("Venta por ", "").toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="pos-cart-item-actions">
                      <span className="pos-cart-item-subtotal">{formatMoney(item.cantidad * item.precioVenta)}</span>
                      <button className="pos-remove-btn" onClick={() => removeItem(item.id)}>
                        <Trash2 size={15} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Método de pago */}
            <div className="pos-pago-metodos">
              <CustomSelect
                options={[{value:"efectivo", label:"Efectivo"}, {value:"yape", label:"Culqi (Yape/Tarjeta)"}]}
                value={metodoPago}
                onChange={(val) => setMetodoPago(val as "efectivo" | "yape")}
                width="100%"
              />
            </div>

            {/* Calculadora de vuelto (solo para efectivo) */}
            {metodoPago === "efectivo" && (
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
            )}

            {/* Pago Digital por Culqi */}
            {metodoPago === "yape" && subtotal > 0 && (
              <div className="pos-cobro">

                {/* ═══ HEADER CON TOTAL ═══ */}
                <div className="pos-culqi">
                  <div className="pos-culqi-header">
                    <CreditCard size={14} strokeWidth={1.75} />
                    <span>PAGO DIGITAL (CULQI)</span>
                  </div>
                  <div className="pos-culqi-amount">
                    <span className="pos-culqi-amount-label">Total a pagar</span>
                    <span className="pos-culqi-amount-value">{formatMoney(subtotal)}</span>
                  </div>

                  {/* ═══ TABS: Yape Directo / Culqi Checkout ═══ */}
                  {!culqiOrderId && !culqiLoading && (
                    <div className="pos-culqi-tabs">
                      <button
                        type="button"
                        className={`pos-culqi-tab ${yapeSubMetodo === "directo" ? "active" : ""}`}
                        onClick={() => { setYapeSubMetodo("directo"); setCulqiError(""); }}
                      >
                        Yape Directo
                      </button>
                      <button
                        type="button"
                        className={`pos-culqi-tab ${yapeSubMetodo === "checkout" ? "active" : ""}`}
                        onClick={() => { setYapeSubMetodo("checkout"); setCulqiError(""); }}
                      >
                        Culqi Checkout
                      </button>
                    </div>
                  )}

                  {/* ═══ FORMULARIO YAPE DIRECTO ═══ */}
                  {yapeSubMetodo === "directo" && !culqiOrderId && !culqiLoading && (
                    <div className="pos-culqi-form">
                      <div className="pos-culqi-field">
                        <label className="pos-culqi-label">Celular de Yape</label>
                        <input
                          type="text"
                          className="pos-culqi-input"
                          placeholder="Ej: 900000001"
                          value={yapeCelular}
                          onChange={(e) => setYapeCelular(e.target.value.replace(/\D/g, "").slice(0, 9))}
                          disabled={culqiLoading}
                        />
                      </div>
                      <div className="pos-culqi-field">
                        <label className="pos-culqi-label">Código de Aprobación (OTP)</label>
                        <input
                          type="text"
                          className="pos-culqi-input"
                          placeholder="Ej: 123456"
                          value={yapeOtp}
                          onChange={(e) => setYapeOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          disabled={culqiLoading}
                        />
                      </div>
                      <button
                        className="pos-culqi-btn-primary"
                        onClick={handlePagarYapeDirecto}
                        disabled={subtotal <= 0 || cartLoading || yapeCelular.length !== 9 || yapeOtp.length !== 6}
                      >
                        Pagar con Yape Directo
                      </button>
                    </div>
                  )}

                  {/* ═══ BOTÓN CULQI CHECKOUT ═══ */}
                  {yapeSubMetodo === "checkout" && !culqiOrderId && !culqiLoading && (
                    <button className="pos-culqi-btn-primary" onClick={handleCobrar}
                      disabled={subtotal <= 0 || cartLoading}
                    >
                      Generar pago Culqi (Popup/QR)
                    </button>
                  )}

                  {/* ═══ CARGANDO ═══ */}
                  {culqiLoading && (
                    <div className="pos-culqi-loading">
                      <span className="pos-spinner" /> Procesando…
                    </div>
                  )}

                  {/* ═══ ERROR ═══ */}
                  {culqiError && (
                    <div className="pos-culqi-error-box">{culqiError}</div>
                  )}

                  {/* ═══ QR GENERADO + VENTA PENDIENTE ═══ */}
                  {culqiOrderId && !culqiLoading && (
                    <>
                      <div className="pos-culqi-qr-card">
                        {!culqiPagado ? (
                          <div className="pos-culqi-qr-status pending">
                            <div className="pos-culqi-qr-status-icon">🖨️</div>
                            <div className="pos-culqi-qr-status-title">Ticket impreso</div>
                            <div className="pos-culqi-qr-status-desc">
                              Entregue el ticket con el QR al cliente para que pague.
                            </div>
                            <div className="pos-culqi-qr-status-ref">
                              Venta #{(ventaPendienteId || "").toString()} — Pendiente de pago
                            </div>
                          </div>
                        ) : (
                          <div className="pos-culqi-qr-status success">
                            <div className="pos-culqi-qr-status-icon">✅</div>
                            <div className="pos-culqi-qr-status-title">Pago confirmado</div>
                          </div>
                        )}

                        {culqiChargeUrl && (
                          <>
                            <div className="pos-culqi-qr-image-wrap">
                              <img
                                src={culqiQrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(culqiChargeUrl)}`}
                                alt="QR de pago"
                                className="pos-culqi-qr-image"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                              />
                            </div>
                            <div className="pos-culqi-qr-url">
                              <span>O comparte este enlace:</span>
                              <input readOnly value={culqiChargeUrl}
                                onClick={(e) => (e.target as HTMLInputElement).select()} />
                              <button className="pos-culqi-btn-secondary" onClick={() => { navigator.clipboard.writeText(culqiChargeUrl); }}>
                                Copiar enlace
                              </button>
                            </div>
                          </>
                        )}

                        <div className="pos-culqi-actions">
                          {!culqiPagado && (
                            <>
                              <button className="pos-culqi-btn-primary" onClick={verificarPagoCulqi}
                                disabled={cartLoading || culqiCompletando}
                              >
                                {culqiCompletando ? (<><span className="pos-spinner" /> Completando…</>) : (<>Verificar pago</>)}
                              </button>
                              <button className="pos-culqi-btn-ghost" onClick={() => imprimirTicketYape(culqiOrderId, culqiChargeUrl, subtotal)}
                                disabled={cartLoading}
                              >
                                Reimprimir ticket
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {cartItems.length > 0 && !ventaPendienteId && !culqiLoading && (
                  <button className="pos-cancel-btn" onClick={clearCart}>
                    Cancelar venta actual
                  </button>
                )}
              </div>
            )}

            {/* Transferencia: flujo manual */}
            {metodoPago === "transferencia" && subtotal > 0 && (
              <div className="pos-cobro">
                <div className="pos-calc-box">
                  <div className="pos-calc-label">
                    <Building size={13} strokeWidth={1.75} />
                    PAGO POR TRANSFERENCIA
                  </div>
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Total a pagar</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{formatMoney(subtotal)}</div>
                  </div>
                  <div style={{ padding: "12px", background: "#eff6ff", borderRadius: "10px", marginBottom: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#1e40af", marginBottom: "6px" }}>Datos de la cuenta bancaria</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>BCP - 123-4567890-0-00</div>
                    <div style={{ fontSize: "0.8rem", color: "#1e40af" }}>PharmaSalud S.A.C.</div>
                    <div style={{ fontSize: "0.75rem", color: "#1e40af", marginTop: "4px" }}>RUC: 20123456789</div>
                  </div>
                  <div className="form-group" style={{ marginTop: "8px" }}>
                    <label className="form-label" style={{ fontSize: "0.78rem" }}>Referencia / N° de operación</label>
                    <input className="input-field" placeholder="Ingrese el código de la transacción" value={referenciaPago}
                      onChange={(e) => setReferenciaPago(e.target.value)} style={{ height: "38px", fontSize: "0.82rem" }} />
                  </div>
                </div>

                <button className="pos-cobrar-btn" onClick={handleCobrar}
                  disabled={subtotal <= 0 || cartLoading || !referenciaPago.trim()}
                >
                  {cartLoading ? (
                    <><span className="pos-spinner" /> Procesando…</>
                  ) : (
                    <>Confirmar pago recibido</>
                  )}
                </button>

                {cartItems.length > 0 && (
                  <button className="pos-cancel-btn" onClick={clearCart}>
                    Cancelar venta actual
                  </button>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ─────────────────────────────── MODALES ─────────────────────────────── */}

      {/* Modal 1: Agregar producto */}
      {selectedProduct && (
        <div className="pos-modal-bg overlay-bg-blur">
          <div className="pos-modal-apple" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <div>
                <span className="pos-modal-kicker">
                  {selectedProduct.producto.categorias?.[0]?.nombre || "Medicamento"}
                  {selectedProduct.producto.laboratorio?.nombre && ` • ${selectedProduct.producto.laboratorio.nombre}`}
                </span>
                <h3 className="pos-modal-title">
                  {selectedProduct.producto.nombreGenerico || selectedProduct.producto.nombreComercial ? (
                    <>
                      {selectedProduct.producto.nombreComercial || selectedProduct.producto.nombreGenerico}
                      {selectedProduct.producto.concentracion && ` ${selectedProduct.producto.concentracion}`}
                    </>
                  ) : (
                    selectedProduct.producto.nombreProducto
                  )}
                </h3>
                {(selectedProduct.producto.nombreGenerico && selectedProduct.producto.nombreComercial && selectedProduct.producto.nombreComercial !== selectedProduct.producto.nombreGenerico) || selectedProduct.producto.presentacion ? (
                  <div className="pos-modal-subtitle">
                    {selectedProduct.producto.nombreComercial && selectedProduct.producto.nombreGenerico && selectedProduct.producto.nombreComercial !== selectedProduct.producto.nombreGenerico && (
                      <span>Principio Activo: {selectedProduct.producto.nombreGenerico}</span>
                    )}
                    {selectedProduct.producto.presentacion && (
                      <span>
                        {selectedProduct.producto.nombreComercial && selectedProduct.producto.nombreGenerico && selectedProduct.producto.nombreComercial !== selectedProduct.producto.nombreGenerico ? " • " : ""}
                        {selectedProduct.producto.presentacion?.toLowerCase() === "caja"
                          ? `Caja x ${selectedProduct.producto.cantidadPresentacion || 100} unidades`
                          : selectedProduct.producto.presentacion}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <button className="pos-modal-close" onClick={() => setSelectedProduct(null)}>
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            <div className="pos-modal-field">
              <label>Formato de venta</label>
              <div className="pos-modal-segments">
                <button
                  type="button"
                  className={`pos-modal-segment ${tipoVenta === "Venta por unidad" ? "active" : ""}`}
                  onClick={() => handleSelectTipoVenta("Venta por unidad")}
                >
                  <span className="segment-label">Unidad</span>
                  <span className="segment-price">{formatMoney(selectedProduct.precioUnidad)}</span>
                </button>
                {selectedProduct.precioCaja > 0 && selectedProduct.producto.categorias?.[0]?.nombre?.toLowerCase() !== "unidad" && (
                  <button
                    type="button"
                    className={`pos-modal-segment ${tipoVenta === "Venta por caja" ? "active" : ""}`}
                    onClick={() => handleSelectTipoVenta("Venta por caja")}
                  >
                    <span className="segment-label">Caja</span>
                    <span className="segment-price">{formatMoney(selectedProduct.precioCaja)}</span>
                  </button>
                )}
                {selectedProduct.producto.cantidadPresentacionBlister && selectedProduct.producto.categorias?.[0]?.nombre?.toLowerCase() !== "unidad" && (
                  <button
                    type="button"
                    className={`pos-modal-segment ${tipoVenta === "Venta por blíster" ? "active" : ""}`}
                    onClick={() => handleSelectTipoVenta("Venta por blíster")}
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
                <label style={{ margin: 0, marginBottom: "6px" }}>Cantidad</label>
                <div className="pos-modal-qty">
                  <button 
                    type="button" 
                    onClick={() => setCantidadAñadir(Math.max(getMaxQtyAñadir() > 0 ? 1 : 0, cantidadAñadir - 1))}
                    disabled={cantidadAñadir <= (getMaxQtyAñadir() > 0 ? 1 : 0)}
                  >
                    <Minus size={12} strokeWidth={2} />
                  </button>
                  <input
                    type="number"
                    min={getMaxQtyAñadir() > 0 ? 1 : 0}
                    max={getMaxQtyAñadir()}
                    value={cantidadAñadir}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const maxQty = getMaxQtyAñadir();
                      setCantidadAñadir(Math.min(maxQty, Math.max(maxQty > 0 ? 1 : 0, val)));
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setCantidadAñadir(Math.min(getMaxQtyAñadir(), cantidadAñadir + 1))}
                    disabled={cantidadAñadir >= getMaxQtyAñadir()}
                  >
                    <Plus size={12} strokeWidth={2} />
                  </button>
                </div>
                <span className="pos-modal-stock-info" style={{ marginTop: "6px", display: "block" }}>
                  Disponible: <strong style={{ fontWeight: 600, color: "#1d1d1f", marginLeft: "3px", marginRight: "3px" }}>{getMaxQtyAñadir()}</strong> {tipoVenta === "Venta por caja" ? "cajas" : tipoVenta === "Venta por blíster" ? "blísteres" : "uds."}
                </span>
              </div>

              <div className="pos-modal-total-display">
                <span className="total-label">Subtotal</span>
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
        <div className="pos-modal-bg overlay-bg-blur">
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
                <span>Método de pago</span>
                <strong style={{ textTransform: "capitalize" }}>
                  {ultimoCobro.metodoPago === "yape" ? "Pago Digital (Culqi)" : ultimoCobro.metodoPago === "transferencia" ? "Transferencia" : "Efectivo"}
                </strong>
              </div>
              {ultimoCobro.metodoPago !== "efectivo" && (
                <div>
                  <span>Referencia</span>
                  <strong style={{ fontSize: "0.82rem" }}>{ultimoCobro.referenciaPago || "—"}</strong>
                </div>
              )}
              {ultimoCobro.metodoPago === "efectivo" && (
                <>
                  <div>
                    <span>Efectivo recibido</span>
                    <strong>{formatMoney(ultimoCobro.pagoCon)}</strong>
                  </div>
                  <div className="pos-success-vuelto">
                    <span>Vuelto entregado</span>
                    <strong>{formatMoney(ultimoCobro.vuelto)}</strong>
                  </div>
                </>
              )}
            </div>

            <div className="pos-modal-actions" style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                <button className="pos-modal-cancel" onClick={() => imprimirTicketQZ(ultimoCobro)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <Receipt size={15} strokeWidth={1.75} />
                  Imprimir (QZ Tray)
                </button>
                <button className="pos-modal-cancel" onClick={() => imprimirTicketHTML(ultimoCobro)} style={{ flex: 1, background: "none", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  Navegador (Backup)
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "4px 0", borderTop: "1px dashed var(--border)", paddingTop: "10px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Impresora QZ:</span>
                <input
                  type="text"
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    width: "150px",
                    textAlign: "right",
                    background: "var(--bg-input, #fff)",
                    color: "#000"
                  }}
                  value={nombreImpresora}
                  onChange={(e) => handleSavePrinterName(e.target.value)}
                  placeholder="Ej. ticketera"
                />
              </div>

              <button className="pos-modal-confirm" onClick={() => setShowSuccessModal(false)} style={{ width: "100%" }}>
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Arqueo de caja */}
      {showArqueoModal && (
        <div className="pos-modal-bg overlay-bg-blur">
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
        <div className="pos-modal-bg overlay-bg-blur">
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
                            onClick={() => imprimirTicketQZ(t)}
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



      {/* ══ Panel lateral: Pedido de compra ══ */}
      {(showPedidoModal || pedidoClosing) && (
        <div className={`pos-pedido-overlay overlay-bg-blur ${pedidoClosing ? "pos-pedido-overlay-closing" : ""}`} onClick={handleClosePedido}>
          <div className={`pos-pedido-panel ${pedidoClosing ? "pos-pedido-panel-closing" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="pos-pedido-header">
              <div>
                <span className="pos-pedido-kicker">Abastecimiento</span>
                <h3 className="pos-pedido-title">Nueva orden de compra</h3>
              </div>
              <button className="pos-pedido-header-close" onClick={handleClosePedido}>
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="pos-pedido-body">
                  {/* ── COLUMNA IZQUIERDA ── */}
                  <div className="pos-pedido-col">
                    {/* Buscar productos */}
                    <div className="pos-pedido-card">
                      <div className="pos-pedido-card-title">
                        Productos
                      </div>
                      <div className="pos-pedido-search-wrap">
                        <Search size={17} className="pos-pedido-search-icon" strokeWidth={1.75} />
                        <input
                          type="text"
                          className="pos-pedido-search-input"
                          placeholder="Buscar medicamento por nombre o categoría..."
                          value={pedidoSearchQuery}
                          onChange={(e) => setPedidoSearchQuery(e.target.value)}
                        />
                        <div className="pos-pedido-search-actions">
                          {pedidoSearchQuery && (
                            <button className="pos-pedido-search-clear" onClick={() => setPedidoSearchQuery("")}>
                              <X size={15} strokeWidth={2} />
                            </button>
                          )}
                          <div className="pos-pedido-search-badge">
                            {pedidoSearchResults.length} RESULTADOS
                          </div>
                        </div>
                      </div>

                      {pedidoSearchQuery && pedidoSearchResults.length > 0 && (
                        <div className="pos-pedido-results">
                          {pedidoSearchResults.slice(0, 6).map((item) => {
                            const alreadyInOrder = pedidoItems.some((p) => p.productoId === item.productoId);
                            return (
                              <div key={item.id} className={`pos-pedido-result ${alreadyInOrder ? "is-added" : ""}`}>
                                <div className="pos-pedido-result-info">
                                  <span className="pos-pedido-result-name">
                                    {item.producto.nombreGenerico || item.producto.nombreComercial ? (
                                      <>
                                        {item.producto.nombreComercial || item.producto.nombreGenerico}
                                        {item.producto.concentracion && ` ${item.producto.concentracion}`}
                                        {item.producto.laboratorio?.nombre && ` (${item.producto.laboratorio.nombre})`}
                                      </>
                                    ) : (
                                      item.producto.nombreProducto
                                    )}
                                  </span>
                                  <span className="pos-pedido-result-stock">
                                    Stock <strong>{item.cantidadTotal}</strong>
                                  </span>
                                </div>
                                <button
                                  className="pos-pedido-result-add"
                                  disabled={alreadyInOrder}
                                  onClick={() => handleAddPedidoItem(item)}
                                >
                                  {alreadyInOrder ? <><CheckCircle2 size={14} strokeWidth={2} /> Agregado</> : "+ Agregar"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {pedidoSearchQuery && pedidoSearchResults.length === 0 && (
                        <div className="pos-pedido-no-results">
                          <AlertTriangle size={16} strokeWidth={1.5} />
                          <span>Sin resultados para <strong>"{pedidoSearchQuery}"</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Producto nuevo */}
                    <div className="pos-pedido-card pos-pedido-card-muted">
                      <div className="pos-pedido-card-title">
                        Producto nuevo
                      </div>
                      <div className="pos-pedido-custom-grid">
                        <div className="pos-pedido-field">
                          <label>Nombre</label>
                          <input
                            type="text"
                            placeholder="Nombre del producto"
                            value={customNombre}
                            onChange={(e) => setCustomNombre(e.target.value)}
                          />
                        </div>
                        <div className="pos-pedido-field">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="0"
                            value={customCantidad}
                            onChange={(e) => setCustomCantidad(e.target.value)}
                          />
                        </div>
                        <button className="pos-pedido-custom-action" onClick={handleAddCustomItem}>
                          <Plus size={15} strokeWidth={2} />
                          Agregar producto
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── COLUMNA DERECHA ── */}
                  <div className="pos-pedido-col">
                    <div className="pos-pedido-card">
                      <div className="pos-pedido-card-title">
                        Resumen de orden
                        {pedidoItems.length > 0 && (
                          <span className="pos-pedido-count-badge">{pedidoItems.length}</span>
                        )}
                      </div>

                      {pedidoItems.length === 0 ? (
                        <div className="pos-pedido-empty">
                          <Package size={40} strokeWidth={1} />
                          <p>Agregue productos desde la sección de búsqueda</p>
                        </div>
                      ) : (
                        <div className="pos-pedido-table-wrap">
                          <table className="pos-pedido-table">
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th style={{ textAlign: "center" }}>Cant.</th>
                                <th style={{ width: 36 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {pedidoItems.map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <div className="pos-pedido-td-name">
                                      <span className="pos-pedido-td-name-text">{item.nombre}</span>
                                      {item.esPersonalizado && <span className="pos-pedido-td-badge">Nuevo</span>}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <div className="pos-pedido-table-qty">
                                      <button onClick={() => handleUpdatePedidoCantidad(item.id, item.cantidad - 1)}>
                                        <Minus size={11} strokeWidth={2.5} />
                                      </button>
                                      <input type="text" value={item.cantidad} readOnly />
                                      <button onClick={() => handleUpdatePedidoCantidad(item.id, item.cantidad + 1)}>
                                        <Plus size={11} strokeWidth={2.5} />
                                      </button>
                                    </div>
                                  </td>
                                  <td>
                                    <button className="pos-pedido-table-remove" onClick={() => handleRemovePedidoItem(item.id)}>
                                      <Trash2 size={14} strokeWidth={1.5} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="pos-pedido-field" style={{ marginTop: 16, marginBottom: 0 }}>
                        <label>Nota (opcional)</label>
                        <textarea
                          rows={2}
                          placeholder="Comentario para el proveedor..."
                          value={pedidoObservaciones}
                          onChange={(e) => setPedidoObservaciones(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pos-pedido-footer">
                  <button className="pos-modal-cancel" onClick={handleClosePedido}>Cancelar</button>
                  <button
                    className="pos-modal-confirm"
                    onClick={handleSubmitPedido}
                    disabled={pedidoSubmitting || pedidoItems.length === 0}
                  >
                    {pedidoSubmitting ? "Enviando…" : "Registrar pedido"}
                  </button>
                </div>
            </div>
          </div>
      )}

      {/* ══ Modal: Pedido registrado exitosamente ══ */}
      {showPedidoSuccessModal && (
        <div className="pos-modal-bg overlay-bg-blur">
          <div className="pos-modal pos-modal-success" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="pos-success-icon" style={{ width: 52, height: 52 }}>
              <CheckCircle2 size={30} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: "0 0 4px" }}>Pedido registrado</h3>
            <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#64748b" }}>
              La orden de compra se creó correctamente.
            </p>
            <button className="pos-modal-confirm" onClick={() => setShowPedidoSuccessModal(false)} style={{ width: "100%" }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────── ESTILOS ─────────────────────────────── */}
      <style>{`
        .pos-root {
          --red:        hsl(var(--primary));
          --red-dark:   #9f1239;
          --red-glow:   rgba(225,29,72,.14);
          --green:      #10b981;
          --green-bg:   rgba(16,185,129,.08);
          --amber:      hsl(var(--warning));
          --amber-bg:   rgba(245,158,11,.08);
          --bg:         hsl(var(--background));
          --surface:    hsl(var(--card));
          --border:     hsl(var(--card-border));
          --border-md:  rgba(15,23,42,.12);
          --text:       hsl(var(--foreground));
          --text-muted: hsl(var(--muted-foreground));
          --radius:     var(--radius-sm);
          --radius-sm:  8px;

          display: flex;
          height: calc(100vh - 76px);
          overflow: hidden;
          background: var(--bg);
          font-family: var(--font-outfit), system-ui, sans-serif;
          padding: 24px 28px;
          gap: 24px;
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
          padding: 0 85px 0 44px;
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
          background: rgba(15, 23, 42, 0.05);
          color: #64748b;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 800;
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
          font-size: 0.85rem;
          font-weight: 400;
          color: var(--text);
          border-bottom: 1.5px solid rgba(15, 23, 42, 0.18);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, background .12s;
          transform: scale(1);
          position: relative;
          z-index: 0;
          background: #fff;
        }

        .pos-table tbody tr { cursor: pointer; perspective: 600px; }
        .pos-table tbody tr:not(.pos-row-disabled):hover td {
          transform: scale(1.025);
          box-shadow: 0 8px 28px rgba(0,0,0,0.07);
          background: #fff;
          z-index: 2;
        }
        .pos-table tbody tr:not(.pos-row-disabled):active td { 
          transform: scale(0.98);
          background: rgba(225, 29, 72, 0.12); 
        }
        .pos-table tbody tr.pos-row-active td { background: rgba(225, 29, 72, 0.08) !important; }
        .pos-table tbody tr:last-child td { border-bottom: none; }

        .pos-row-disabled td { opacity: .45; pointer-events: none; }

        .pos-td-name-inner {
          font-weight: 400 !important;
          max-width: 380px;
          white-space: normal;
          word-break: break-word;
        }

        .pos-prod-pill {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 8px;
          background: #f1f5f9;
          color: #475569;
          border-radius: 6px;
          border: 1px solid rgba(15,23,42,0.06);
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
        }

        .pos-prod-name {
          font-size: 0.85rem;
          color: #0f172a;
          font-weight: 400;
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

        .pos-td-price { font-weight: 400 !important; font-variant-numeric: tabular-nums; }

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
          margin: 16px 16px 8px;
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
          padding: 12px 16px;
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
          flex-direction: column;
          gap: 6px;
          padding: 13px 14px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.14);
          transition: background .12s;
        }

        .pos-cart-item:hover { background: #fafafa; }

        .pos-cart-item-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pos-cart-item-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #1E293B;
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
        }

        .pos-cart-item-actions {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 8px;
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
          padding: 4px 16px 20px;
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

        /* ══ CULQI - PAGO DIGITAL ══ */
        .pos-culqi {
          padding: 14px 16px;
          background: #F5F5F7;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.15);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .pos-culqi-header {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.68rem;
          font-weight: 800;
          color: rgba(29,29,31,.38);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .pos-culqi-header svg { color: #7c3aed; }

        .pos-culqi-amount {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 4px 0 2px;
        }
        .pos-culqi-amount-label {
          font-size: 0.78rem;
          font-weight: 500;
          color: rgba(29,29,31,.45);
        }
        .pos-culqi-amount-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #7c3aed;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1.1;
        }

        .pos-culqi-tabs {
          display: flex;
          gap: 6px;
          background: rgba(0,0,0,.04);
          border-radius: 10px;
          padding: 3px;
        }
        .pos-culqi-tab {
          flex: 1;
          padding: 9px 12px;
          border-radius: 8px;
          border: none;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .18s ease;
          background: transparent;
          color: rgba(29,29,31,.5);
        }
        .pos-culqi-tab.active {
          background: #ffffff;
          color: #7c3aed;
          box-shadow: 0 1px 4px rgba(0,0,0,.06);
        }

        .pos-culqi-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pos-culqi-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pos-culqi-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(29,29,31,.55);
          letter-spacing: 0.02em;
        }
        .pos-culqi-input {
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid rgba(15,23,42,.14);
          background: #ffffff;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          color: #1D1D1F;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
          box-sizing: border-box;
        }
        .pos-culqi-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124,58,237,.12);
        }
        .pos-culqi-input::placeholder {
          color: rgba(29,29,31,.25);
          font-weight: 400;
        }
        .pos-culqi-input:disabled {
          opacity: .4;
          cursor: not-allowed;
        }

        .pos-culqi-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 48px;
          border-radius: 10px;
          background: #7c3aed;
          border: none;
          color: #fff;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: filter .18s, transform .12s, box-shadow .18s;
          box-shadow: 0 4px 14px rgba(124,58,237,.25);
        }
        .pos-culqi-btn-primary:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(124,58,237,.3);
        }
        .pos-culqi-btn-primary:disabled {
          opacity: .35;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .pos-culqi-btn-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 38px;
          border-radius: 8px;
          background: #374151;
          border: none;
          color: #fff;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: filter .15s;
        }
        .pos-culqi-btn-secondary:hover { filter: brightness(1.12); }

        .pos-culqi-btn-ghost {
          width: 100%;
          height: 42px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(29,29,31,.12);
          color: rgba(29,29,31,.5);
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: background .15s, color .15s;
        }
        .pos-culqi-btn-ghost:hover {
          background: rgba(29,29,31,.04);
          color: rgba(29,29,31,.7);
        }

        .pos-culqi-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 20px;
          color: rgba(29,29,31,.4);
          font-size: 0.82rem;
          font-weight: 500;
        }

        .pos-culqi-error-box {
          padding: 10px 14px;
          background: #fef2f2;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.8rem;
          font-weight: 500;
          text-align: center;
          border: 1px solid rgba(220,38,38,.1);
        }

        .pos-culqi-qr-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
          background: #f0fdf4;
          border-radius: 12px;
          border: 1px solid rgba(22,101,52,.1);
          text-align: center;
        }
        .pos-culqi-qr-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .pos-culqi-qr-status-icon {
          font-size: 1.4rem;
          margin-bottom: 2px;
        }
        .pos-culqi-qr-status-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #166534;
        }
        .pos-culqi-qr-status-desc {
          font-size: 0.72rem;
          font-weight: 500;
          color: #15803d;
        }
        .pos-culqi-qr-status-ref {
          font-size: 0.65rem;
          font-weight: 500;
          color: rgba(29,29,31,.38);
          margin-top: 2px;
        }
        .pos-culqi-qr-image-wrap {
          width: 180px;
          height: 180px;
          background: #ffffff;
          margin: 0 auto;
          border-radius: 10px;
          border: 1px solid rgba(22,101,52,.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pos-culqi-qr-image {
          width: 170px;
          height: 170px;
          border-radius: 4px;
        }
        .pos-culqi-qr-url {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 2px;
        }
        .pos-culqi-qr-url span {
          font-size: 0.65rem;
          font-weight: 500;
          color: rgba(29,29,31,.35);
        }
        .pos-culqi-qr-url input {
          width: 100%;
          padding: 8px 10px;
          font-size: 0.62rem;
          font-family: monospace;
          border: 1px solid rgba(15,23,42,.12);
          border-radius: 6px;
          background: #ffffff;
          color: #374151;
          outline: none;
          box-sizing: border-box;
        }

        .pos-culqi-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 2px;
        }

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
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: pos-fade-in .18s ease;
        }

        @keyframes pos-fade-in { from { opacity: 0; } to { opacity: 1; } }

        /* ══ MODAL APPLE MINIMALISTA ══ */
        .pos-modal-apple {
          width: min(100%, 460px);
          background: #ffffff;
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02);
          border: 1px solid rgba(0, 0, 0, 0.06);
          animation: pos-apple-scale .28s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: var(--font-outfit), system-ui, sans-serif;
        }

        .pos-modal-apple button,
        .pos-modal-apple input,
        .pos-modal-apple select,
        .pos-modal-apple textarea {
          font-family: var(--font-outfit), system-ui, sans-serif !important;
        }

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

        @keyframes pos-apple-scale {
          from { transform: scale(0.96); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }

        @keyframes pos-slide-up {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }

        .pos-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .pos-modal-kicker {
          display: block;
          font-size: 0.68rem;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 3px;
        }

        .pos-modal-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
          color: #1d1d1f;
          line-height: 1.25;
          letter-spacing: -0.015em;
        }

        .pos-modal-subtitle {
          font-size: 0.78rem;
          color: #86868b;
          margin-top: 4px;
          font-weight: 500;
        }

        .pos-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(118, 118, 128, 0.12);
          border: none;
          color: #86868b;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pos-modal-close:hover {
          background: rgba(118, 118, 128, 0.2);
          color: #1d1d1f;
          transform: rotate(90deg);
        }

        .pos-modal-close:active {
          transform: scale(0.92) rotate(90deg);
        }

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
          margin-bottom: 20px;
        }

        .pos-modal-field label {
          font-size: 0.72rem;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .pos-modal-segments {
          display: flex;
          background: #f5f5f7;
          padding: 2.5px;
          border-radius: 10px;
          border: none;
        }

        .pos-modal-segment {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
          padding: 6px 2px;
          border-radius: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pos-modal-segment:hover:not(.active) {
          background: rgba(0, 0, 0, 0.02);
        }

        .pos-modal-segment.active {
          background: #ffffff;
          color: #1d1d1f;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 1px rgba(0, 0, 0, 0.04);
        }

        .segment-label {
          font-size: 0.78rem;
          font-weight: 500;
          color: #86868b;
          transition: color 0.15s;
        }

        .pos-modal-segment.active .segment-label {
          color: #1d1d1f;
          font-weight: 600;
        }

        .segment-price {
          font-size: 0.78rem;
          font-weight: 600;
          color: #86868b;
          font-variant-numeric: tabular-nums;
          transition: color 0.15s;
        }

        .pos-modal-segment.active .segment-price {
          color: #1d1d1f;
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
          border-color: #0071e3;
          background-color: #ffffff;
          box-shadow: none;
        }

        .pos-modal-footer-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid #e8e8ed;
          margin-top: 20px;
        }

        .pos-modal-stock-info {
          font-size: 0.75rem;
          color: #86868b;
          font-weight: 500;
        }

        .pos-modal-qty {
          display: flex;
          align-items: center;
          background: #f5f5f7;
          border-radius: 8px;
          padding: 2px;
          width: 108px;
          height: 32px;
          border: none;
        }

        .pos-modal-qty button {
          width: 30px;
          height: 28px;
          background: transparent;
          border: none;
          color: #0071e3;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s, background-color 0.15s;
          border-radius: 6px;
        }

        .pos-modal-qty button:hover:not(:disabled) {
          background-color: rgba(0, 0, 0, 0.04);
        }

        .pos-modal-qty button:disabled {
          opacity: 0.25;
          color: #86868b;
          cursor: not-allowed;
        }

        .pos-modal-qty input {
          width: 44px !important;
          height: 28px !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
          outline: none !important;
          text-align: center !important;
          font-family: var(--font-outfit), system-ui, sans-serif !important;
          font-size: 0.92rem !important;
          font-weight: 600 !important;
          color: #1d1d1f !important;
          box-shadow: none !important;
        }

        .pos-modal-total-display {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .total-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .total-val {
          font-size: 1.35rem;
          font-weight: 600;
          color: #1d1d1f;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }

        .pos-modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .pos-modal-cancel {
          flex: 1;
          height: 44px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pos-modal-cancel:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .pos-modal-cancel:active {
          transform: scale(0.98);
        }

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

        /* ══ BOTONES EXCLUSIVOS MODAL APPLE ══ */
        .pos-modal-apple .pos-modal-cancel {
          background: #f5f5f7;
          border: none;
          color: #1d1d1f;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.88rem;
          font-weight: 500;
          border-radius: 10px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, transform 0.1s;
        }

        .pos-modal-apple .pos-modal-cancel:hover {
          background: #e8e8ed;
          color: #1d1d1f;
        }

        .pos-modal-apple .pos-modal-cancel:active {
          transform: scale(0.97);
        }

        .pos-modal-apple .pos-modal-confirm {
          background: #e11d48;
          border: none;
          color: #ffffff;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: 0.88rem;
          font-weight: 600;
          border-radius: 10px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, transform 0.1s, filter 0.15s;
        }

        .pos-modal-apple .pos-modal-confirm:hover {
          background: #f43f5e;
          filter: none;
        }

        .pos-modal-apple .pos-modal-confirm:active {
          background: #be123c;
          transform: scale(0.97);
        }

        /* Cerrar del modal Apple en rojo premium */
        .pos-modal-apple .pos-modal-close {
          background: rgba(225, 29, 72, 0.08);
          color: #e11d48;
        }

        .pos-modal-apple .pos-modal-close:hover {
          background: rgba(225, 29, 72, 0.16);
          color: #be123c;
        }

        .pos-modal-apple .pos-modal-close:active {
          background: rgba(225, 29, 72, 0.24);
          transform: scale(0.92) rotate(90deg);
        }

        /* ══ ESTILOS DE MODAL DE ALERTA PERSONALIZADO ══ */
        .pos-modal-alert {
          text-align: center;
          width: min(100%, 360px);
          animation: pos-apple-scale .24s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 20px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          padding: 28px;
          background: #ffffff;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .pos-modal-alert h3 {
          margin: 0 0 8px;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1d1d1f;
        }

        .pos-modal-alert p {
          margin: 0 0 20px;
          font-size: 0.88rem;
          line-height: 1.5;
          color: #64748b;
          font-weight: 500;
        }

        .pos-alert-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .pos-alert-icon.warning {
          background: rgba(245, 158, 11, 0.1);
          border: 2px solid rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .pos-alert-icon.error {
          background: rgba(225, 29, 72, 0.1);
          border: 2px solid rgba(225, 29, 72, 0.2);
          color: #e11d48;
        }

        .pos-alert-icon.success {
          background: rgba(16, 185, 129, 0.1);
          border: 2px solid rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .pos-alert-icon.info {
          background: rgba(14, 165, 233, 0.1);
          border: 2px solid rgba(14, 165, 233, 0.2);
          color: #0ea5e9;
        }

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
          font-weight: 400;
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
          margin: 16px 16px 0;
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
          background: #e11d48;
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
          color: #e11d48;
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

        .pos-ventas-filter {
          position: relative; display: flex; align-items: center;
          margin: 12px 16px 12px;
        }
        .pos-ventas-filter-icon {
          position: absolute; left: 10px;
          color: #94a3b8; pointer-events: none;
        }
        .pos-ventas-filter-input {
          width: 100%; height: 34px;
          padding: 0 30px 0 32px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          outline: none;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: .78rem;
          font-weight: 500;
          color: #0f172a;
          transition: border-color .15s;
        }
        .pos-ventas-filter-input::placeholder { color: #94a3b8; font-weight: 400; }
        .pos-ventas-filter-input:focus { border-color: #e11d48; }
        .pos-ventas-filter-clear {
          position: absolute; right: 6px;
          display: flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 4px;
          background: none; border: none; color: #94a3b8;
          cursor: pointer;
        }
        .pos-ventas-filter-clear:hover { color: #0f172a; background: #f1f5f9; }

        .pos-ventas-items {
          flex: 1;
          overflow-y: auto;
          padding: 0 16px 12px;
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
          border-color: rgba(225,29,72,.2);
          box-shadow: 0 4px 12px rgba(225,29,72,.04);
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
          color: #e11d48;
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
          background: rgba(225,29,72,.05);
          border-color: rgba(225,29,72,.2);
          color: #be123c;
        }

        /* ══ PEDIDO — PANEL LATERAL ══ */
        @keyframes pedidoSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes pedidoSlideOut {
          from { transform: translateX(0); }
          to   { transform: translateX(100%); }
        }
        @keyframes pedidoFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pedidoFadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .pos-pedido-overlay {
          position: fixed; inset: 0; z-index: 100;
          animation: pedidoFadeIn .2s ease;
        }
        .pos-pedido-overlay-closing {
          animation: pedidoFadeOut .35s ease forwards;
        }
        .pos-pedido-panel {
          --p-red: #e11d48;
          --p-red-dark: #be123c;
          --red: var(--p-red);
          --surface: #f9fafb;
          --border: #e2e4e9;
          --radius: 8px;
          --text-muted: #64748b;
          --text: #111827;
          position: fixed; top: 0; right: 0;
          width: 100vw; height: 100vh;
          background: #fff;
          box-shadow: -8px 0 48px rgba(15,23,42,.15);
          display: flex; flex-direction: column;
          animation: pedidoSlideIn .35s cubic-bezier(.16,1,.3,1);
          z-index: 101;
        }
        .pos-pedido-panel-closing {
          animation: pedidoSlideOut .3s cubic-bezier(.16,1,.3,1) forwards;
        }
        .pos-pedido-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          border-bottom: 1px solid #e9eaeb;
          flex-shrink: 0;
          background: #fafbfc;
        }
        .pos-pedido-kicker {
          display: block;
          font-size: .65rem; font-weight: 700;
          color: var(--p-red);
          text-transform: uppercase;
          letter-spacing: .12em; margin-bottom: 2px;
        }
        .pos-pedido-title {
          margin: 0; font-size: 1.15rem; font-weight: 700;
          color: #0f172a; letter-spacing: -.01em;
        }
        .pos-pedido-header-close {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 8px;
          background: #fff; border: 1px solid #e2e4e9;
          color: #6b7280;
          cursor: pointer; transition: all .15s;
          flex-shrink: 0;
        }
        .pos-pedido-header-close:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: var(--p-red);
        }
        .pos-pedido-body {
          flex: 1; overflow-y: auto;
          padding: 24px 32px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          background: #f3f4f6;
        }
        .pos-pedido-body::-webkit-scrollbar { width: 5px; }
        .pos-pedido-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
        .pos-pedido-col {
          display: flex; flex-direction: column; gap: 20px;
        }
        .pos-pedido-card {
          background: #fff;
          border-radius: 14px;
          padding: 20px 22px;
          border: 1px solid #e9eaeb;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .pos-pedido-card-muted {
          background: #f8f9fb;
          border-color: #e5e7eb;
        }
        .pos-pedido-card-title {
          display: flex; align-items: center; gap: 8px;
          font-size: .68rem; font-weight: 800; color: #0f172a;
          text-transform: uppercase; letter-spacing: .08em;
          margin-bottom: 14px;
        }
        .pos-pedido-card-title svg {
          color: var(--p-red);
          flex-shrink: 0;
        }
        .pos-pedido-count-badge {
          margin-left: auto;
          background: #0f172a;
          color: #fff;
          font-size: .6rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 10px;
          letter-spacing: 0;
        }
        .pos-pedido-field {
          display: flex; flex-direction: column; gap: 5px;
        }
        .pos-pedido-field label {
          font-size: .68rem; font-weight: 700; color: #6b7280;
          text-transform: uppercase; letter-spacing: .06em;
        }
        .pos-pedido-select,
        .pos-pedido-field input,
        .pos-pedido-field textarea {
          width: 100%; padding: 10px 13px;
          background: #f9fafb;
          border: 1.5px solid #e2e4e9;
          border-radius: 10px;
          font-family: var(--font-outfit), system-ui, sans-serif;
          font-size: .85rem; font-weight: 500; color: #111827;
          outline: none;
          transition: border-color .15s, background .15s;
        }
        .pos-pedido-select:focus,
        .pos-pedido-field input:focus,
        .pos-pedido-field textarea:focus {
          border-color: var(--p-red);
          background: #fff;
        }
        .pos-pedido-select {
          cursor: pointer;
          appearance: none;
          background: #f9fafb url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 12px center;
          padding-right: 36px;
        }
        .pos-pedido-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .pos-pedido-search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
          z-index: 1;
        }
        input.pos-pedido-search-input {
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
        .pos-pedido-search-input::placeholder { color: #94a3b8; }
        input.pos-pedido-search-input:focus {
          border-color: var(--red);
          box-shadow: none;
        }
        .pos-pedido-search-actions {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 2;
        }
        .pos-pedido-search-clear {
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
        .pos-pedido-search-clear:hover { color: var(--text); background: rgba(15,23,42,.06); }
        .pos-pedido-search-badge {
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
        .pos-pedido-field textarea { resize: vertical; min-height: 60px; }
        .pos-pedido-results {
          margin-top: 14px;
          display: flex; flex-direction: column;
          border: 1px solid #e9eaeb;
          border-radius: 10px;
          overflow: hidden;
          background: #fff;
        }
        .pos-pedido-no-results {
          margin-top: 14px;
          display: flex; align-items: center; gap: 8px;
          padding: 14px 16px;
          background: #fef9e7;
          border: 1px solid #fde68a;
          border-radius: 10px;
          font-size: .82rem; font-weight: 500; color: #92400e;
        }
        .pos-pedido-no-results svg { color: #f59e0b; flex-shrink: 0; }
        .pos-pedido-result {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px;
          border-bottom: 1px solid #f3f4f6;
          transition: background .12s;
        }
        .pos-pedido-result:last-child { border-bottom: none; }
        .pos-pedido-result:hover { background: #fafbfc; }
        .pos-pedido-result.is-added { background: #f0fdf4; }
        .pos-pedido-result-info {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .pos-pedido-result-name {
          font-size: .85rem; font-weight: 700; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pos-pedido-result-stock {
          font-size: .72rem; font-weight: 500; color: #6b7280;
        }
        .pos-pedido-result-stock strong { font-weight: 700; color: #374151; }
        .pos-pedido-result-add {
          padding: 8px 18px;
          border-radius: 8px;
          background: var(--p-red);
          border: none; color: #fff;
          font-family: var(--font-outfit), sans-serif;
          font-size: .82rem; font-weight: 600;
          cursor: pointer; transition: all .15s;
          white-space: nowrap; flex-shrink: 0;
          display: flex; align-items: center; gap: 6px;
          box-shadow: 0 1px 3px rgba(225,29,72,.2);
        }
        .pos-pedido-result-add:hover:not(:disabled) {
          background: var(--p-red-dark);
          box-shadow: 0 2px 8px rgba(225,29,72,.3);
        }
        .pos-pedido-result-add:disabled {
          background: transparent;
          color: #22c55e;
          box-shadow: none;
          cursor: default;
          font-weight: 700;
          padding: 8px 14px;
        }
        /* ── Producto nuevo ── */
        .pos-pedido-custom-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        }
        .pos-pedido-custom-action {
          grid-column: 1 / -1;
          padding: 11px;
          border-radius: 10px;
          background: var(--p-red);
          border: none; color: #fff;
          font-family: var(--font-outfit), sans-serif;
          font-size: .82rem; font-weight: 600;
          cursor: pointer; transition: all .15s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          box-shadow: 0 1px 3px rgba(225,29,72,.2);
        }
        .pos-pedido-custom-action:hover {
          background: var(--p-red-dark);
          box-shadow: 0 2px 8px rgba(225,29,72,.3);
        }
        /* ── Tabla de pedido ── */
        .pos-pedido-table-wrap {
          overflow-x: auto;
          border: 1px solid #e9eaeb;
          border-radius: 10px;
          background: #fff;
        }
        .pos-pedido-table {
          width: 100%; border-collapse: collapse;
        }
        .pos-pedido-table thead th {
          padding: 10px 14px;
          font-size: .64rem; font-weight: 700; color: #6b7280;
          text-transform: uppercase; letter-spacing: .06em;
          background: #f9fafb;
          border-bottom: 1.5px solid #e9eaeb;
          white-space: nowrap;
          text-align: left;
        }
        .pos-pedido-table td {
          padding: 10px 14px;
          font-size: .82rem; font-weight: 500; color: #111827;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }
        .pos-pedido-table tbody tr:last-child td { border-bottom: none; }
        .pos-pedido-table tbody tr:hover td { background: rgba(225,29,72,.04); }
        .pos-pedido-td-name {
          display: flex; align-items: center; gap: 6px;
        }
        .pos-pedido-td-name-text {
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .pos-pedido-td-badge {
          font-size: .55rem; font-weight: 800;
          color: #f59e0b;
          text-transform: uppercase;
          letter-spacing: .04em;
          background: #fef9e7;
          padding: 1px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .pos-pedido-table-qty {
          display: inline-flex; align-items: center;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }
        .pos-pedido-table-qty button {
          width: 28px; height: 26px; padding: 0;
          background: #f9fafb; border: none;
          color: #374151; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .1s;
        }
        .pos-pedido-table-qty button:hover { background: #e5e7eb; }
        .pos-pedido-table-qty input {
          width: 34px; height: 26px; padding: 0; background: #fff;
          border: none; border-left: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          outline: none; text-align: center;
          font-family: var(--font-outfit), sans-serif;
          font-size: .82rem; font-weight: 700; color: #111827;
        }
        .pos-pedido-table-remove {
          background: none; border: none; color: #ef4444;
          cursor: pointer; padding: 5px; border-radius: 6px;
          opacity: .4; transition: all .15s;
          display: flex;
        }
        .pos-pedido-table-remove:hover {
          opacity: 1; background: #fef2f2;
        }
        .pos-pedido-empty {
          text-align: center; padding: 48px 16px;
          color: #9ca3af;
          border: 1.5px dashed #d1d5db;
          border-radius: 12px;
          background: #fafbfc;
        }
        .pos-pedido-empty svg {
          opacity: .25;
          margin-bottom: 12px;
        }
        .pos-pedido-empty p {
          font-size: .82rem; font-weight: 500;
          margin: 0; line-height: 1.5;
        }
        .pos-pedido-footer {
          display: flex; gap: 10px;
          padding: 16px 32px 20px;
          border-top: 1px solid #e9eaeb;
          flex-shrink: 0; background: #fafbfc;
        }
        .pos-pedido-footer .pos-modal-cancel {
          flex: 1; height: 44px;
          border: 1.5px solid #d1d5db;
          background: #fff;
          border-radius: 8px;
          font-size: .85rem;
          font-weight: 600;
          color: #374151;
          transition: all .15s;
        }
        .pos-pedido-footer .pos-modal-cancel:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        .pos-pedido-footer .pos-modal-confirm {
          flex: 1.6; height: 44px;
          background: var(--p-red);
          border: none;
          border-radius: 8px;
          font-size: .85rem;
          font-weight: 600;
          color: #fff;
          transition: all .15s;
          box-shadow: 0 1px 4px rgba(225,29,72,.25);
        }
        .pos-pedido-footer .pos-modal-confirm:hover:not(:disabled) {
          background: var(--p-red-dark);
          box-shadow: 0 2px 8px rgba(225,29,72,.35);
        }
        .pos-pedido-footer .pos-modal-confirm:disabled {
          opacity: .45; cursor: default; box-shadow: none;
        }

        /* ── Métodos de pago ── */
        .pos-pago-metodos {
          padding: 8px 16px;
        }
      `}</style>
    </>
  );
}
