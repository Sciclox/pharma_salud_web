"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Receipt, Store, User, Calendar, X, AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import jsPDF from "jspdf";

interface Venta {
  id: number;
  sucursalId: number;
  usuarioId: number;
  fecha: string;
  total: number;
  pagoCon: number;
  vuelto: number;
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
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [vendedores, setVendedores] = useState<Personal[]>([]);
  
  // Filtros
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("todos");
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [fechaInicio, setFechaInicio] = useState<string>("");
  const [fechaFin, setFechaFin] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Detalle de Venta Activo (Modal)
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);

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
    if (!confirm("¿Está seguro de marcar este producto como devuelto? Se reingresará el stock físico a la sucursal de origen, se sumará el lote correspondiente y se generará una entrada positiva en el Kardex de auditoría.")) {
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

  // Generar Ticket PDF
  const generateTicketPDF = (venta: Venta) => {
    const doc = new jsPDF({
      unit: "mm",
      format: [80, 150],
    });

    doc.setFont("courier");
    doc.setFontSize(9);

    doc.text("BOTICA PHARMA SALUD", 40, 10, { align: "center" });
    doc.setFontSize(8);
    doc.text("RUC: 10427847118", 40, 14, { align: "center" });
    doc.text(venta.sucursal.nombre.substring(0, 32), 40, 18, { align: "center" });
    doc.text("--------------------------------", 40, 22, { align: "center" });

    doc.text(`TICKET N°: 0000${venta.id}`, 5, 27);
    doc.text(`FECHA: ${new Date(venta.fecha).toLocaleString()}`, 5, 31);
    doc.text(`VEND: ${venta.usuario.nombreVendedor}`, 5, 35);
    doc.text("--------------------------------", 40, 40, { align: "center" });

    doc.text("CANT  DESCRIPCIÓN      IMPORTE", 5, 45);
    doc.text("--------------------------------", 40, 49, { align: "center" });

    let y = 54;
    venta.detalles.forEach(item => {
      const desc = item.nombreProducto.substring(0, 16);
      const sub = item.cantidad * item.precioVenta;
      const devMark = item.devolucion === "Si" ? " (DEV)" : "";
      doc.text(`${item.cantidad.toString().padEnd(4)}  ${(desc + devMark).padEnd(16)} S/${sub.toFixed(2)}`, 5, y);
      y += 5;
    });

    doc.text("--------------------------------", 40, y + 2, { align: "center" });
    y += 7;

    doc.text(`TOTAL:        S/${venta.total.toFixed(2)}`, 45, y);
    doc.text(`RECIBIDO:     S/${venta.pagoCon.toFixed(2)}`, 45, y + 4);
    doc.text(`CAMBIO:       S/${venta.vuelto.toFixed(2)}`, 45, y + 8);

    y += 15;
    doc.text("COPIA DE TICKET HISTÓRICO", 40, y, { align: "center" });
    doc.text("SISTEMA ADMINISTRATIVO WEB", 40, y + 4, { align: "center" });

    window.open(doc.output("bloburl"), "_blank");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. FILTROS AVANZADOS */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          flexWrap: "wrap",
          gap: "16px",
          background: "hsl(var(--card))",
          padding: "20px 24px",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--card-border))"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", flex: 1 }}>
          {/* Farmacia */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Farmacia:</span>
            <select
              className="input-field"
              value={sucursalFiltro}
              onChange={(e) => setSucursalFiltro(e.target.value)}
              style={{ width: "200px", height: "42px", padding: "8px 12px" }}
            >
              <option value="todos">🌍 Todas (Consolidado)</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Vendedor */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Vendedor:</span>
            <select
              className="input-field"
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              style={{ width: "180px", height: "42px", padding: "8px 12px" }}
            >
              <option value="todos">Todos</option>
              {vendedores.map(v => (
                <option key={v.id} value={v.id.toString()}>{v.nombreVendedor}</option>
              ))}
            </select>
          </div>

          {/* Fecha Inicio */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Fecha Inicio:</span>
            <input
              type="date"
              className="input-field"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{ width: "160px", height: "42px", padding: "8px 12px" }}
            />
          </div>

          {/* Fecha Fin */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Fecha Fin:</span>
            <input
              type="date"
              className="input-field"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{ width: "160px", height: "42px", padding: "8px 12px" }}
            />
          </div>
        </div>

        {/* Resumen Recaudación Neta */}
        <div 
          style={{
            background: "hsl(var(--muted))",
            padding: "12px 24px",
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid hsl(var(--card-border))",
            display: "flex",
            flexDirection: "column",
            alignItems: "end",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>
            Recaudación Neta (Lun - Dom)
          </span>
          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "hsl(var(--success))" }}>
            {formatMoney(getRecaudacionNeta())}
          </span>
        </div>
      </div>

      {/* 2. TABLA DE VENTAS */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando historial de ventas...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Ticket N°</th>
                <th>Fecha / Hora</th>
                <th>Farmacia</th>
                <th>Vendedor</th>
                <th>Monto Total</th>
                <th>Venta Neta</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se registraron ventas en el periodo o filtros seleccionados.
                  </td>
                </tr>
              ) : (
                ventas.map((venta) => {
                  // Calcular neto descontando devoluciones
                  const neto = venta.detalles.reduce((acc, det) => {
                    return acc + (det.devolucion === "No" ? det.cantidad * det.precioVenta : 0);
                  }, 0);

                  const tieneDevoluciones = venta.detalles.some(d => d.devolucion === "Si");

                  return (
                    <tr key={venta.id}>
                      <td style={{ fontWeight: 700 }}>#{venta.id}</td>
                      <td>{new Date(venta.fecha).toLocaleString("es-PE")}</td>
                      <td style={{ fontWeight: 600 }}>{venta.sucursal.nombre}</td>
                      <td>{venta.usuario.nombreVendedor}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(venta.total)}</td>
                      <td style={{ fontWeight: 700, color: tieneDevoluciones ? "hsl(var(--danger))" : "hsl(var(--foreground))" }}>
                        {formatMoney(neto)}
                        {tieneDevoluciones && <span style={{ fontSize: "0.7rem", display: "block", fontWeight: 600 }}>(Con devoluciones)</span>}
                      </td>
                      <td>
                        <button 
                          className="btn btn-outline"
                          onClick={() => setSelectedVenta(venta)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.8rem",
                            borderRadius: "var(--radius-sm)",
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
      )}

      {/* MODAL: Detalles del Ticket & Devoluciones */}
      {selectedVenta && (
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
              onClick={() => setSelectedVenta(null)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: "1.2rem", marginBottom: "4px" }}>
              Detalles de Venta (Ticket #{selectedVenta.id})
            </h3>
            <span style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))", fontWeight: 600, display: "block", marginBottom: "20px" }}>
              Farmacia: {selectedVenta.sucursal.nombre} | Procesado por: {selectedVenta.usuario.nombreVendedor}
            </span>

            {/* Listado de items del ticket */}
            <div className="table-container" style={{ flex: 1, overflowY: "auto" }}>
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Tipo</th>
                    <th>Cant</th>
                    <th>Precio</th>
                    <th>Importe</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVenta.detalles.map((det) => (
                    <tr key={det.id}>
                      <td style={{ fontWeight: 600 }}>{det.nombreProducto}</td>
                      <td style={{ fontSize: "0.8rem" }}>{det.tipoVenta.replace("Venta por ", "")}</td>
                      <td>{det.cantidad}</td>
                      <td>{formatMoney(det.precioVenta)}</td>
                      <td style={{ fontWeight: 700 }}>{formatMoney(det.cantidad * det.precioVenta)}</td>
                      <td>
                        <span className={`badge ${det.devolucion === "Si" ? "badge-danger" : "badge-success"}`}>
                          {det.devolucion === "Si" ? "Devuelto" : "Completado"}
                        </span>
                      </td>
                      <td>
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
                          <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Procesado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sumatoria */}
            <div 
              style={{
                background: "hsl(var(--muted))",
                padding: "16px",
                borderRadius: "var(--radius-sm)",
                border: "1.5px solid hsl(var(--card-border))",
                marginTop: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>PAGÓ CON: {formatMoney(selectedVenta.pagoCon)}</span>
                <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>VUELTO: {formatMoney(selectedVenta.vuelto)}</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
                <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 700 }}>TOTAL NETO:</span>
                <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "hsl(var(--primary))" }}>
                  {formatMoney(selectedVenta.detalles.reduce((acc, d) => acc + (d.devolucion === "No" ? d.cantidad * d.precioVenta : 0), 0))}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button className="btn btn-primary" onClick={() => generateTicketPDF(selectedVenta)} style={{ flex: 1 }}>
                Imprimir Copia Ticket
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedVenta(null)} style={{ flex: 1 }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
