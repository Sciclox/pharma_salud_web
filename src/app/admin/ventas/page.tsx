"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import CustomSelect from "@/components/CustomSelect";
import SucursalSelector from "@/components/SucursalSelector";
import DatePicker from "@/components/DatePicker";
import { Search, Receipt, Store, User, X, AlertTriangle, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Venta {
  id: number;
  sucursalId: number;
  usuarioId: number;
  fecha: string;
  total: number;
  pagoCon: number;
  vuelto: number;
  metodoPago: string;
  referenciaPago: string | null;
  estado: string;
  usuario: {
    nombreVendedor: string;
  };
  sucursal: {
    nombre: string;
  };
  detalles: {
    id: number;
    productoId: number;
    nombreProducto: string;
    tipoVenta: string;
    cantidad: number;
    precioVenta: number;
    devolucion: string;
  }[];
}

interface Sucursal {
  id: number;
  nombre: string;
}

interface Personal {
  id: number;
  nombreVendedor: string;
  rol: string;
}

export default function AdminVentas() {
  const searchParams = useSearchParams();
  const sucursalFiltro = searchParams.get("sucursalId") || "todos";
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [vendedores, setVendedores] = useState<Personal[]>([]);
  
  // Filtros
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Resetear a la página 1 cuando cambian los filtros o la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sucursalFiltro, vendedorFiltro, fechaInicio, fechaFin]);

  // Detalle de Venta Activo (Modal)
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  useEscapeToClose(!!selectedVenta, useCallback(() => setSelectedVenta(null), []));
  useBodyScrollLock(!!selectedVenta);

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
        console.log("QZ Tray SDK cargado exitosamente en Admin.");
      };
      script.onerror = () => {
        console.error("Error al cargar QZ Tray SDK desde CDN en Admin.");
      };
      document.body.appendChild(script);
    }
  }, []);

  // Cargar filtros de soporte
  const fetchFiltros = useCallback(async () => {
    try {
      const [resSuc, resUser] = await Promise.all([
        fetch("/api/sucursales"),
        fetch("/api/usuarios"),
      ]);

      if (resSuc.ok) setSucursales(await resSuc.json());
      if (resUser.ok) setVendedores(await resUser.json());
    } catch (error) {
      console.error("Error al obtener filtros de soporte:", error);
    }
  }, []);

  // Cargar ventas según los filtros activos
  const fetchVentas = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/ventas?";
      if (sucursalFiltro !== "todos") url += `sucursalId=${sucursalFiltro}&`;
      if (vendedorFiltro !== "todos") url += `usuarioId=${vendedorFiltro}&`;
      if (fechaInicio) url += `fechaInicio=${fechaInicio}&`;
      if (fechaFin) url += `fechaFin=${fechaFin}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVentas(data);
      }
    } catch (error) {
      console.error("Error al cargar ventas:", error);
    } finally {
      setLoading(false);
    }
  }, [sucursalFiltro, vendedorFiltro, fechaInicio, fechaFin]);

  useEffect(() => {
    fetchFiltros();
    fetchVentas();
  }, [fetchFiltros, fetchVentas]);

  // Procesar Devolución de un item de venta
  const handleDevolverItem = async (detalleId: number) => {
    const confirmed = await (window as any).showConfirm("¿Está seguro de marcar este producto como devuelto? Se reingresará el stock físico a la sucursal de origen, se sumará el lote correspondiente y se generará una entrada positiva en el Kardex de auditoría.");
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/ventas/${detalleId}/devolucion`, {
        method: "POST",
      });

      if (res.ok) {
        alert("Producto devuelto y stock reingresado con éxito.");
        
        // Recargar datos
        fetchVentas();
        
        // Actualizar la modal activa si está abierta para ver el cambio de estado 'Si'
        if (selectedVenta) {
          const resVentaActualizada = await fetch(`/api/ventas?sucursalId=${selectedVenta.sucursalId}`);
          if (resVentaActualizada.ok) {
            const list = await resVentaActualizada.json();
            const find = list.find((v: any) => v.id === selectedVenta.id);
            if (find) setSelectedVenta(find);
          }
        }
      } else {
        const errData = await res.json();
        alert(`Error al procesar devolución: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al procesar devolución:", error);
    }
  };

  // Calcular el total neto recaudado (excluyendo montos devueltos)
  const getRecaudacionNeta = () => {
    return ventas.reduce((acc, venta) => {
      // Sumar solo los items del detalle que no hayan sido marcados como devueltos (devolucion === 'No')
      const netoVenta = venta.detalles.reduce((accDet, det) => {
        if (det.devolucion === "No") {
          return accDet + det.cantidad * det.precioVenta;
        }
        return accDet;
      }, 0);
      return acc + netoVenta;
    }, 0);
  };

  const cleanText = (text: string) => {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remueve tildes
      .replace(/[^ -~\n]/g, "") // Solo ASCII imprimible + salto de línea
      .toUpperCase();
  };

  const generarComandosEscPos = (venta: Venta) => {
    const sucursalNombre = (venta.sucursal.nombre || "AV. LARCO 456, TRUJILLO").toUpperCase();
    const vendedorStr = (venta.usuario.nombreVendedor || "").toUpperCase();
    const fechaStr = new Date(venta.fecha).toLocaleString();
    const total = venta.total.toFixed(2);
    const pagoCon = venta.pagoCon.toFixed(2);
    const vuelto = venta.vuelto.toFixed(2);

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

    // Encabezado
    data.push(ALIGN_CENTER);
    data.push("BOTICA PHARMA SALUD\n");
    data.push("RUC: 10427847118\n");
    data.push(`${cleanText(sucursalNombre)}\n`);
    data.push("------------------------------------------------\n");

    // Datos de Venta
    data.push(ALIGN_LEFT);
    data.push(`TICKET N°: 0000${venta.id}\n`);
    data.push(`FECHA: ${fechaStr}\n`);
    if (vendedorStr) {
      data.push(`VEND: ${cleanText(vendedorStr)}\n`);
    }
    data.push("------------------------------------------------\n");
    data.push("CANT  DESCRIPCION                        IMPORTE\n");
    data.push("------------------------------------------------\n");

    // Items
    venta.detalles.forEach(item => {
      const desc = item.nombreProducto.substring(0, 26);
      const sub = (item.cantidad * item.precioVenta).toFixed(2);
      const devMark = item.devolucion === "Si" ? " (DEV)" : "";
      
      const cantCol = item.cantidad.toString().padEnd(4);
      const descCol = cleanText(desc + devMark).padEnd(26);
      const subCol = `S/ ${sub}`.padStart(14);
      
      data.push(`${cantCol}  ${descCol}  ${subCol}\n`);
    });

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
    data.push("COPIA DE TICKET HISTORICO\n");
    data.push("SISTEMA ADMINISTRATIVO WEB\n");
    data.push("GRACIAS POR SU PREFERENCIA\n");
    data.push("VUELVA PRONTO\n");

    // Corte de papel
    data.push("\n\n\n\n\n");
    data.push("\x1D\x56\x42\x00"); // Corte parcial (GS V 66)

    return data;
  };

  const imprimirTicketQZ = async (venta: Venta) => {
    const qz = (window as any).qz;
    if (!qz) {
      alert("El SDK de QZ Tray no se ha cargado. Por favor recargue la página.");
      return;
    }

    try {
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
      }

      const config = qz.configs.create(nombreImpresora, { forceRaw: true });
      const rawData = generarComandosEscPos(venta);
      
      await qz.print(config, rawData);
    } catch (err: any) {
      console.error("Error al imprimir con QZ Tray:", err);
      alert(
        `Error al imprimir por QZ Tray. Asegúrese de que QZ Tray esté abierto y que la impresora se llame '${nombreImpresora}'.\nDetalle: ${err.message || err}`
      );
    }
  };

  // Imprimir Ticket HTML
  const imprimirTicketHTML = (venta: Venta) => {
    const sucursalNombre = (venta.sucursal.nombre || "AV. LARCO 456, TRUJILLO").toUpperCase();
    const vendedorStr = (venta.usuario.nombreVendedor || "").toUpperCase();
    const fechaStr = new Date(venta.fecha).toLocaleString();
    const total = venta.total.toFixed(2);
    const pagoCon = venta.pagoCon.toFixed(2);
    const vuelto = venta.vuelto.toFixed(2);

    let itemsText = "";
    venta.detalles.forEach(item => {
      const desc = item.nombreProducto.substring(0, 26);
      const sub = (item.cantidad * item.precioVenta).toFixed(2);
      const devMark = item.devolucion === "Si" ? " (DEV)" : "";
      
      const cantCol = item.cantidad.toString().padEnd(4);
      const descCol = (desc + devMark).padEnd(26);
      const subCol = `S/ ${sub}`.padStart(14);
      
      itemsText += `${cantCol}  ${descCol}  ${subCol}\n`;
    });

    // Generar la cadena de texto plano alineada a 48 caracteres
    let text = "";
    text += "              BOTICA PHARMA SALUD\n";
    text += "                RUC: 10427847118\n";
    
    // Centrar la sucursal (máximo 48 caracteres)
    const sucursalCentrada = sucursalNombre.substring(0, 48);
    const padSucursal = Math.max(0, Math.floor((48 - sucursalCentrada.length) / 2));
    text += " ".repeat(padSucursal) + sucursalCentrada + "\n";
    
    text += "------------------------------------------------\n";
    text += `TICKET N°: 0000${venta.id}\n`;
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
    text += "           COPIA DE TICKET HISTORICO\n";
    text += "           SISTEMA ADMINISTRATIVO WEB\n";
    text += "           GRACIAS POR SU PREFERENCIA\n";
    text += "                 VUELVA PRONTO\n";

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



  // Cálculos estadísticos reactivos
  const filteredVentas = ventas.filter(v => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    const ticketIdStr = v.id.toString();
    const matchesTicket = ticketIdStr.includes(query) || `#${ticketIdStr}`.includes(query);
    const matchesSeller = v.usuario.nombreVendedor.toLowerCase().includes(query);
    const matchesSucursal = v.sucursal.nombre.toLowerCase().includes(query);
    const matchesProduct = v.detalles.some(d => d.nombreProducto.toLowerCase().includes(query));
    
    return matchesTicket || matchesSeller || matchesSucursal || matchesProduct;
  });

  const totalTickets = filteredVentas.length;
  
  const recaudacionNeta = filteredVentas.reduce((acc, v) => {
    const netoVenta = v.detalles.reduce((accDet, det) => {
      if (det.devolucion === "No") {
        return accDet + det.cantidad * det.precioVenta;
      }
      return accDet;
    }, 0);
    return acc + netoVenta;
  }, 0);

  const totalDevoluciones = filteredVentas.reduce((acc, v) => {
    return acc + v.detalles.filter(d => d.devolucion === "Si").length;
  }, 0);

  // Paginación del lado del cliente
  const ITEMS_PER_PAGE = 15;
  const totalItems = filteredVentas.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  
  const paginatedVentas = filteredVentas.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  return (
    <>
      <div className="admin-products-root">
        {/* 1. CABECERA */}
        <div className="admin-header-row">
          <div>
            <h1 className="admin-page-title">Libro de Dispensación</h1>
            <p className="admin-page-subtitle">Historial de tickets, recaudación en caja y control de devoluciones en tiempo real.</p>
          </div>
        </div>

        {/* 2. TARJETAS DE ESTADÍSTICAS */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card stat-card-total">
            <div className="admin-stat-icon-wrap" style={{ background: "rgba(225, 29, 72, 0.08)", color: "#e11d48" }}>
              <Receipt size={20} />
            </div>
            <div className="admin-stat-content">
              <span className="admin-stat-label">Total Tickets</span>
              <span className="admin-stat-val">{totalTickets}</span>
              <span className="admin-stat-sub">Ventas filtradas</span>
            </div>
          </div>

          <div className="admin-stat-card stat-card-inversion">
            <div className="admin-stat-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981" }}>
              <TrendingUp size={20} />
            </div>
            <div className="admin-stat-content">
              <span className="admin-stat-label">Recaudación Neta</span>
              <span className="admin-stat-val" style={{ color: "#10b981" }}>{formatMoney(recaudacionNeta)}</span>
              <span className="admin-stat-sub">Excluye devoluciones</span>
            </div>
          </div>

          <div className="admin-stat-card stat-card-stock">
            <div className="admin-stat-icon-wrap" style={{ background: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" }}>
              <AlertTriangle size={20} />
            </div>
            <div className="admin-stat-content">
              <span className="admin-stat-label">Ítems Devueltos</span>
              <span className="admin-stat-val" style={{ color: "#f59e0b" }}>{totalDevoluciones}</span>
              <span className="admin-stat-sub">Reingresados a stock</span>
            </div>
          </div>
        </div>

        {/* 3. BARRA DE FILTROS Y BÚSQUEDA */}
        <div className="admin-filter-card" style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "stretch" }}>
          <div className="admin-search-box-wrap" style={{ flex: 1 }}>
            <Search size={18} className="admin-search-icon" strokeWidth={2.2} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Buscar por Ticket N°, vendedor, producto o sucursal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="admin-search-clear-btn" onClick={() => setSearchQuery("")} style={{ right: "14px" }}>
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px", padding: "0 4px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Farmacia
              </label>
              <SucursalSelector />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Vendedor
              </label>
              <CustomSelect
                options={[
                  { value: "todos", label: "Todos los vendedores" },
                  ...vendedores.map(v => ({ value: v.id.toString(), label: v.nombreVendedor }))
                ]}
                value={vendedorFiltro}
                onChange={(val) => setVendedorFiltro(val)}
                width="180px"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Desde
              </label>
              <DatePicker
                value={fechaInicio}
                onChange={setFechaInicio}
                placeholder="Seleccionar"
                width="160px"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Hasta
              </label>
              <DatePicker
                value={fechaFin}
                onChange={setFechaFin}
                placeholder="Seleccionar"
                width="160px"
              />
            </div>
          </div>
        </div>

        {/* 4. TABLA DE VENTAS */}
        {loading ? (
          <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
            <p>Cargando historial de ventas...</p>
          </div>
        ) : (
          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ticket N°</th>
                    <th>Fecha / Hora</th>
                    <th>Farmacia</th>
                    <th>Vendedor</th>
                    <th className="text-right">Monto Total</th>
                    <th className="text-right">Venta Neta</th>
                    <th className="text-center">Método de Pago</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center" style={{ width: "120px" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVentas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="admin-table-empty">
                        <div className="admin-empty-state">
                          <Receipt size={40} className="admin-empty-icon" />
                          <p>No se registraron ventas en el periodo o filtros seleccionados.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedVentas.map((venta) => {
                      const neto = venta.detalles.reduce((acc, det) => {
                        return acc + (det.devolucion === "No" ? det.cantidad * det.precioVenta : 0);
                      }, 0);

                      const tieneDevoluciones = venta.detalles.some(d => d.devolucion === "Si");

                      return (
                        <tr key={venta.id}>
                          <td style={{ fontWeight: 400, color: "#0f172a" }}>#{venta.id}</td>
                          <td style={{ fontSize: "0.85rem", color: "#475569" }}>
                            {new Date(venta.fecha).toLocaleString("es-PE")}
                          </td>
                          <td style={{ fontWeight: 400, color: "#0f172a" }}>
                            {venta.sucursal.nombre.replace("Botica Pharma Salud - ", "")}
                          </td>
                          <td style={{ color: "#475569", fontWeight: 500 }}>{venta.usuario.nombreVendedor}</td>
                          <td className="text-right" style={{ fontWeight: 400 }}>{formatMoney(venta.total)}</td>
                          <td className="text-right" style={{ fontWeight: 400, color: tieneDevoluciones ? "#ef4444" : "#0f172a" }}>
                            {formatMoney(neto)}
                            {tieneDevoluciones && (
                              <span style={{ fontSize: "0.68rem", display: "block", fontWeight: 400, color: "#ef4444" }}>
                                (Con devoluciones)
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <span className={`badge-premium ${
                              venta.metodoPago === "yape" ? "badge-premium-info" :
                              venta.metodoPago === "transferencia" ? "badge-premium-warning" :
                              "badge-premium-success"
                            }`} style={{ textTransform: "capitalize" }}>
                              {venta.metodoPago === "yape" ? "Yape" : venta.metodoPago === "transferencia" ? "Transferencia" : "Efectivo"}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`badge-premium ${
                              venta.estado === "pendiente" ? "badge-premium-warning" :
                              "badge-premium-success"
                            }`} style={{ textTransform: "capitalize" }}>
                              {venta.estado === "pendiente" ? "Pendiente" : "Completado"}
                            </span>
                          </td>
                          <td className="text-center">
                            <button 
                              className="admin-edit-inv-btn"
                              onClick={() => setSelectedVenta(venta)}
                              style={{
                                padding: "6px 12px",
                                fontSize: "0.8rem",
                                borderRadius: "6px",
                              }}
                            >
                              Ver Detalles
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderTop: "1px solid rgba(15,23,42,0.06)",
                background: "#fff",
              }}>
                <span style={{ fontSize: "0.82rem", color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
                  Mostrando <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a{" "}
                  <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> de{" "}
                  <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{totalItems}</span> ventas
                </span>

                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                    disabled={currentPage === 1}
                    className="admin-pagination-btn"
                  >
                    <ChevronLeft size={14} />
                    <span>Anterior</span>
                  </button>

                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    if (totalPages <= maxVisible) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push("...");
                      
                      const start = Math.max(2, currentPage - 1);
                      const end = Math.min(totalPages - 1, currentPage + 1);
                      
                      for (let i = start; i <= end; i++) {
                        if (!pages.includes(i)) pages.push(i);
                      }
                      
                      if (currentPage < totalPages - 2) pages.push("...");
                      if (!pages.includes(totalPages)) pages.push(totalPages);
                    }

                    return pages.map((page, index) => {
                      if (page === "...") {
                        return (
                          <span key={`dots-${index}`} style={{ padding: "6px 10px", color: "#94a3b8", fontSize: "0.85rem" }}>
                            ...
                          </span>
                        );
                      }
                      
                      const isSelected = page === currentPage;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(Number(page))}
                          className={`admin-pagination-number ${isSelected ? "active" : ""}`}
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}

                  <button
                    onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="admin-pagination-btn"
                  >
                    <span>Siguiente</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL: Detalles del Ticket & Devoluciones */}
        {selectedVenta && (
          <div className="admin-modal-overlay-centered overlay-bg-blur" onClick={() => setSelectedVenta(null)}>
            <div className="admin-modal-card-centered" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "680px", padding: "32px 36px" }}>
              <button 
                onClick={() => setSelectedVenta(null)}
                className="admin-modal-close-btn"
              >
                <X size={18} />
              </button>

              <h3 className="admin-modal-title" style={{ margin: 0, fontSize: "1.35rem" }}>
                Detalles de Venta (Ticket #{selectedVenta.id})
              </h3>
              <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "20px" }}>
                Farmacia: {selectedVenta.sucursal.nombre.replace("Botica Pharma Salud - ", "")} | Vendedor: {selectedVenta.usuario.nombreVendedor} | 
                Pago: <span style={{ textTransform: "capitalize", fontWeight: 700 }}>
                  {selectedVenta.metodoPago === "yape" ? "Yape" : selectedVenta.metodoPago === "transferencia" ? "Transferencia" : "Efectivo"}
                </span>
                {selectedVenta.referenciaPago && <> | Ref: {selectedVenta.referenciaPago}</>}
                | Estado: <span className={`badge-premium ${
                  selectedVenta.estado === "pendiente" ? "badge-premium-warning" : "badge-premium-success"
                }`} style={{ textTransform: "capitalize", fontSize: "0.72rem", padding: "2px 8px" }}>
                  {selectedVenta.estado === "pendiente" ? "Pendiente" : "Completado"}
                </span>
              </span>

              {/* Listado de items del ticket */}
              <div className="admin-table-card" style={{ flex: 1, overflowY: "auto" }}>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Medicamento</th>
                        <th>Tipo</th>
                        <th>Cant</th>
                        <th>Precio</th>
                        <th>Importe</th>
                        <th>Estado</th>
                        <th className="text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVenta.detalles.map((det) => (
                        <tr key={det.id}>
                          <td style={{ fontWeight: 400, color: "#0f172a" }}>{det.nombreProducto}</td>
                          <td style={{ fontSize: "0.8rem", color: "#475569" }}>{det.tipoVenta.replace("Venta por ", "")}</td>
                          <td>{det.cantidad}</td>
                          <td>{formatMoney(det.precioVenta)}</td>
                          <td style={{ fontWeight: 400, color: "#0f172a" }}>{formatMoney(det.cantidad * det.precioVenta)}</td>
                          <td>
                            <span className={`badge ${det.devolucion === "Si" ? "badge-danger" : "badge-success"}`}>
                              {det.devolucion === "Si" ? "Devuelto" : "Completado"}
                            </span>
                          </td>
                          <td className="text-center">
                            {det.devolucion === "No" ? (
                              <button 
                                className="btn btn-danger"
                                onClick={() => handleDevolverItem(det.id)}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "0.75rem",
                                  borderRadius: "4px"
                                }}
                              >
                                Anular
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Procesado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sumatoria */}
              <div 
                style={{
                  background: "#f8fafc",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {selectedVenta.metodoPago === "efectivo" ? (
                    <>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>PAGÓ CON: {formatMoney(selectedVenta.pagoCon)}</span>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>VUELTO: {formatMoney(selectedVenta.vuelto)}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "capitalize" }}>
                        PAGO CON: {selectedVenta.metodoPago === "yape" ? "Yape" : "Transferencia"}
                      </span>
                      {selectedVenta.referenciaPago && (
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>
                          REF: {selectedVenta.referenciaPago}
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>TOTAL NETO:</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#e11d48" }}>
                    {formatMoney(selectedVenta.detalles.reduce((acc, d) => acc + (d.devolucion === "No" ? d.cantidad * d.precioVenta : 0), 0))}
                  </span>
                </div>
              </div>

              {/* Impresión */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px", borderTop: "1.5px dashed rgba(15, 23, 42, 0.08)", paddingTop: "15px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="btn btn-primary" onClick={() => imprimirTicketQZ(selectedVenta)} style={{ flex: 1 }}>
                    Imprimir (QZ Tray)
                  </button>
                  <button className="btn btn-secondary" onClick={() => imprimirTicketHTML(selectedVenta)} style={{ flex: 1 }}>
                    Navegador (Backup)
                  </button>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem", color: "#64748b", padding: "0 4px" }}>
                  <span style={{ fontWeight: 600 }}>Impresora QZ:</span>
                  <input
                    type="text"
                    style={{
                      padding: "6px 10px",
                      fontSize: "0.78rem",
                      borderRadius: "6px",
                      border: "1.5px solid rgba(15, 23, 42, 0.08)",
                      width: "150px",
                      textAlign: "right",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 600,
                      outline: "none"
                    }}
                    value={nombreImpresora}
                    onChange={(e) => handleSavePrinterName(e.target.value)}
                    placeholder="Ej. ticketera"
                  />
                </div>

                <button className="btn btn-secondary" onClick={() => setSelectedVenta(null)} style={{ width: "100%", marginTop: "4px" }}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .admin-products-root {
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

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .admin-stat-card {
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.02);
          position: relative;
          overflow: hidden;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.22s ease, box-shadow 0.22s ease;
        }

        .admin-stat-card::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.45;
          transition: opacity 0.22s ease;
        }

        .stat-card-total::after {
          background: radial-gradient(circle at 15% 50%, rgba(225, 29, 72, 0.05) 0%, rgba(255, 255, 255, 0) 65%);
        }

        .stat-card-stock::after {
          background: radial-gradient(circle at 15% 50%, rgba(245, 158, 11, 0.05) 0%, rgba(255, 255, 255, 0) 65%);
        }

        .stat-card-inversion::after {
          background: radial-gradient(circle at 15% 50%, rgba(16, 185, 129, 0.05) 0%, rgba(255, 255, 255, 0) 65%);
        }

        .admin-stat-card:hover {
          transform: translateY(-3px);
          border-color: rgba(15, 23, 42, 0.14);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
        }

        .admin-stat-card:hover::after {
          opacity: 0.75;
        }

        .admin-stat-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 1;
        }

        .admin-stat-content {
          display: flex;
          flex-direction: column;
          z-index: 1;
        }

        .admin-stat-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .admin-stat-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          margin: 4px 0 2px;
          line-height: 1;
        }

        .admin-stat-sub {
          font-size: 0.72rem;
          font-weight: 500;
          color: #94a3b8;
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

        /* Table Helpers */
        .text-center { text-align: center; }
        .text-right { text-align: right; }

        /* Action Buttons inside Table */
        .admin-edit-inv-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: #f1f5f9;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          color: #475569;
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }

        .admin-edit-inv-btn:hover {
          background: rgba(225, 29, 72, 0.04);
          border-color: rgba(225, 29, 72, 0.2);
          color: #e11d48;
        }

        /* Centered Dialog Modals */
        .admin-modal-overlay-centered {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: admin-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 20px;
          background: rgba(0, 0, 0, 0.4);
        }

        .admin-modal-card-centered {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          width: 100%;
          max-width: 680px;
          max-height: 90vh;
          padding: 32px 36px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04);
          position: relative;
          display: flex;
          flex-direction: column;
          animation: admin-zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes admin-zoom-in {
          from {
            transform: scale(0.95) translateY(10px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes admin-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .admin-modal-close-btn {
          position: absolute;
          top: 24px;
          right: 24px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          transition: background 0.12s, color 0.12s;
          z-index: 10;
        }

        .admin-modal-close-btn:hover {
          background: #f1f5f9;
          color: #475569;
        }

        .admin-modal-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 4px;
          letter-spacing: -0.02em;
        }
      `}</style>
    </>
  );
}
