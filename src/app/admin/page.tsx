"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { 
  TrendingUp, 
  PackageX, 
  AlertOctagon, 
  DollarSign, 
  ArrowRight, 
  Activity, 
  ShoppingBag, 
  FileText,
  Calendar,
  Thermometer,
  CheckCircle,
  Building2,
  X,
  Bell,
  Download
} from "lucide-react";
import jsPDF from "jspdf";
import { formatMoney } from "@/lib/format";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CustomSelect from "@/components/CustomSelect";
import SucursalSelector from "@/components/SucursalSelector";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface DashboardStats {
  ventasHoy: number;
  productosBajoStock: number;
  lotesPorVencer: number;
  lotesVencidos: number;
  sobranteHoy: number;
  totalVentasSemana: number;
}

const COLORS = ["#e11d48", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#64748b"];

function DashboardContent() {
  const searchParams = useSearchParams();
  const sucursalSeleccionada = searchParams.get("sucursalId") || "todos";

  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    productosBajoStock: 0,
    lotesPorVencer: 0,
    lotesVencidos: 0,
    sobranteHoy: 0,
    totalVentasSemana: 0,
  });
  const [productosBajoStockList, setProductosBajoStockList] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [alertasCriticas, setAlertasCriticas] = useState<any[]>([]);
  const [alertasDescartadas, setAlertasDescartadas] = useState<number[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [ventasData, setVentasData] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [semanaOffset, setSemanaOffset] = useState<string>("0");
  const [yearSeleccionado, setYearSeleccionado] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cargar métricas del backend reales
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParam = sucursalSeleccionada !== "todos" ? `?sucursalId=${sucursalSeleccionada}` : "";
      
      const resVentas = await fetch(`/api/ventas${queryParam}`);
      const resInventario = await fetch(`/api/inventarios${queryParam}`);
      const resVencimiento = await fetch(`/api/fecha-vencimiento`);
      const resSobrante = await fetch(`/api/sobrante-caja`);

      let ventasHoySum = 0;
      let totalVencidos = 0;
      let totalPorVencer = 0;
      let totalBajoStock = 0;
      let sobranteHoySum = 0;
      let totalVentasSemanaSum = 0;
      let ventasList: any[] = [];

      const hoyStr = new Date().toISOString().split("T")[0];

      // 1. Procesar Ventas
      if (resVentas.ok) {
        ventasList = await resVentas.json();
        setVentasData(ventasList);
        
        const ventasHoy = ventasList.filter((v: any) => v.fecha.startsWith(hoyStr));
        ventasHoySum = ventasHoy.reduce((acc: number, v: any) => acc + v.total, 0);

        const haceUnaSemana = new Date();
        haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
        const ventasSemana = ventasList.filter((v: any) => new Date(v.fecha) >= haceUnaSemana);
        totalVentasSemanaSum = ventasSemana.reduce((acc: number, v: any) => acc + v.total, 0);
      }

      // 2. Procesar Inventario
      if (resInventario.ok) {
        const inventarios = await resInventario.json();
        const bajoStock = inventarios.filter((inv: any) => inv.cantidadTotal <= inv.stockMinimo);
        totalBajoStock = bajoStock.length;
        setProductosBajoStockList(bajoStock);
      }

      // 3. Procesar Vencimiento
      if (resVencimiento.ok) {
        const lotes = await resVencimiento.json();
        const hoy = new Date();
        const unMesDespues = new Date();
        unMesDespues.setDate(hoy.getDate() + 30);

        const lotesFiltrados = sucursalSeleccionada !== "todos"
          ? lotes.filter((l: any) => l.sucursalId === parseInt(sucursalSeleccionada))
          : lotes;

        lotesFiltrados.forEach((lote: any) => {
          const vDate = new Date(lote.fechaVencimiento);
          if (vDate < hoy) {
            totalVencidos++;
          } else if (vDate <= unMesDespues) {
            totalPorVencer++;
          }
        });
      }

      // 4. Procesar Arqueos
      if (resSobrante.ok) {
        const sobrantes = await resSobrante.json();
        const sobrantesHoy = sobrantes.filter((s: any) => {
          const isToday = s.fecha.startsWith(hoyStr);
          const isSucursal = sucursalSeleccionada === "todos" || s.sucursalId === parseInt(sucursalSeleccionada);
          return isToday && isSucursal;
        });
        sobranteHoySum = sobrantesHoy.reduce((acc: number, s: any) => acc + s.monto, 0);
      }

      const nuevasAlertas = [];
      if (totalVencidos > 0) {
        nuevasAlertas.push({
          id: 1,
          tipo: "danger",
          mensaje: `ALERTA DE SEGURIDAD: Se detectaron ${totalVencidos} lotes de medicamentos VENCIDOS. Retiro y cuarentena obligatorios.`,
        });
      }
      if (totalPorVencer > 0) {
        nuevasAlertas.push({
          id: 2,
          tipo: "warning",
          mensaje: `ADVERTENCIA: Hay ${totalPorVencer} lotes de fármacos que vencerán en los próximos 30 días. Planifique rotación prioritaria.`,
        });
      }
      if (totalBajoStock > 0) {
        nuevasAlertas.push({
          id: 3,
          tipo: "warning",
          mensaje: `REPOSICIÓN REQUERIDA: Se detectaron ${totalBajoStock} productos con stock crítico (igual o menor al stock mínimo).`,
        });
      }

      setAlertasCriticas(nuevasAlertas);
      setStats({
        ventasHoy: ventasHoySum,
        productosBajoStock: totalBajoStock,
        lotesPorVencer: totalPorVencer,
        lotesVencidos: totalVencidos,
        sobranteHoy: sobranteHoySum,
        totalVentasSemana: totalVentasSemanaSum,
      });

    } catch (error) {
      console.error("Error al cargar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [sucursalSeleccionada]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Obtener los años disponibles desde la primera venta
  const getAnosDisponibles = () => {
    const hoy = new Date();
    const curYear = hoy.getFullYear();
    if (ventasData.length === 0) {
      return [{ value: curYear.toString(), label: curYear.toString() }];
    }
    const fechas = ventasData.map(v => new Date(v.fecha).getTime());
    const oldestTime = Math.min(...fechas);
    const oldestYear = new Date(oldestTime).getFullYear();
    const options = [];
    for (let y = curYear; y >= oldestYear; y--) {
      options.push({ value: y.toString(), label: y.toString() });
    }
    return options;
  };

  // Obtener las semanas disponibles desde la primera venta (máximo 6 semanas)
  const getSemanasDisponibles = () => {
    const labels = ["Esta Semana", "Semana Anterior", "Hace 2 Semanas", "Hace 3 Semanas", "Hace 4 Semanas", "Hace 5 Semanas"];
    if (ventasData.length === 0) {
      return [{ value: "0", label: labels[0] }];
    }
    const hoy = new Date();
    const day = hoy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const lunesActual = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diff, 12, 0, 0);
    
    const fechas = ventasData.map(v => new Date(v.fecha).getTime());
    const oldestTime = Math.min(...fechas);
    const oldestDate = new Date(oldestTime);
    const oldestDay = oldestDate.getDay();
    const oldestDiff = oldestDay === 0 ? -6 : 1 - oldestDay;
    const lunesOldest = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), oldestDate.getDate() + oldestDiff, 12, 0, 0);
    
    const diffMs = lunesActual.getTime() - lunesOldest.getTime();
    const diffWeeks = Math.max(0, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
    const totalWeeks = Math.min(diffWeeks, 5); 
    
    const options = [];
    for (let i = 0; i <= totalWeeks; i++) {
      options.push({ value: i.toString(), label: labels[i] || `Hace ${i} Semanas` });
    }
    return options;
  };

  // Agrupar ventas
  const getVentasSemanaData = () => {
    const diasSemana = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    const data = [];
    const hoy = new Date();
    const day = hoy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    
    // Aplicar offset semanal
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diff - (parseInt(semanaOffset) * 7), 12, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunes.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const name = diasSemana[i];
      
      const totalDia = ventasData
        .filter((v: any) => v.fecha.startsWith(dateStr))
        .reduce((acc: number, v: any) => acc + v.total, 0);
        
      data.push({ name, ventas: totalDia });
    }
    return data;
  };

  const getVentasMensualesData = () => {
    const nombresMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const data = [];
    
    for (let i = 0; i < 12; i++) {
      const name = nombresMeses[i];
      
      const totalMes = ventasData
        .filter((v: any) => {
          const vDate = new Date(v.fecha);
          return vDate.getFullYear() === parseInt(yearSeleccionado) && vDate.getMonth() === i;
        })
        .reduce((acc: number, v: any) => acc + v.total, 0);
        
      data.push({ name, ventas: totalMes });
    }
    return data;
  };

  // Resetear filtros si el valor actual no es válido al cambiar los datos de ventas
  useEffect(() => {
    if (isMounted) {
      const validSemanas = getSemanasDisponibles();
      if (!validSemanas.some(o => o.value === semanaOffset)) {
        setSemanaOffset("0");
      }
      const validAnos = getAnosDisponibles();
      if (!validAnos.some(o => o.value === yearSeleccionado)) {
        setYearSeleccionado(new Date().getFullYear().toString());
      }
    }
  }, [ventasData, isMounted]);

  const getSucursalesBreakdown = () => {
    const sucursalesMap: { [key: string]: number } = {};
    ventasData.forEach((v: any) => {
      const name = v.sucursal?.nombre?.replace("Botica Pharma Salud - ", "") || `Sucursal ${v.sucursalId}`;
      sucursalesMap[name] = (sucursalesMap[name] || 0) + v.total;
    });
    return Object.entries(sucursalesMap)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  };

  const getCategoryBreakdown = () => {
    const categoriesMap: { [key: string]: number } = {};
    ventasData.forEach((v: any) => {
      v.detalles?.forEach((d: any) => {
        const cat = d.producto?.categorias?.[0]?.nombre || "General";
        const itemTotal = d.cantidad * d.precioVenta;
        categoriesMap[cat] = (categoriesMap[cat] || 0) + itemTotal;
      });
    });
    return Object.entries(categoriesMap)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  // Exportar Reporte de Stock Crítico en PDF
  const handleExportReposicionPdf = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");
    doc.setFontSize(18);

    doc.text("REPORTE DE REPOSICIÓN - STOCK CRÍTICO", 14, 15);
    doc.setFontSize(10);
    doc.text(`Sucursal/Botica: ${sucursalSeleccionada === "todos" ? "Todas las sucursales" : sucursalSeleccionada}`, 14, 21);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString("es-PE")} ${new Date().toLocaleTimeString("es-PE")}`, 14, 25);
    doc.text("---------------------------------------------------------------------------------------------------", 14, 30);

    doc.setFontSize(11);
    doc.text("CANT SUGERIDA    MEDICAMENTO                           STOCK ACT    STOCK MÍN", 14, 36);
    doc.text("---------------------------------------------------------------------------------------------------", 14, 40);

    let y = 46;
    if (productosBajoStockList.length === 0) {
      doc.text("No se registran medicamentos bajo el stock mínimo en esta sucursal.", 14, y);
    } else {
      productosBajoStockList.forEach((inv: any) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        // Cantidad sugerida a pedir para volver a tener stock óptimo (2 veces el stock mínimo)
        const sugerido = Math.max(0, (inv.stockMinimo * 2) - inv.cantidadTotal);
        const cant = `${sugerido} u.`.padEnd(16);
        const name = (inv.producto?.nombreProducto || "Producto").substring(0, 34).padEnd(36);
        const stockAct = `${inv.cantidadTotal} u.`.padEnd(12);
        const stockMin = `${inv.stockMinimo} u.`;
        doc.text(`${cant}  ${name}  ${stockAct}  ${stockMin}`, 14, y);
        y += 7;
      });
    }

    doc.save(`lista_reposicion_sucursal_${sucursalSeleccionada}.pdf`);
  };

  const chartSemanaData = getVentasSemanaData();
  const chartMensualData = getVentasMensualesData();
  const breakdownSucursales = getSucursalesBreakdown();
  const breakdownCategorias = getCategoryBreakdown();

  const activeAlertas = alertasCriticas.filter(a => !alertasDescartadas.includes(a.id));
  const countAlertas = activeAlertas.length;

  const ultimasVentas = ventasData
    .slice()
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", fontFamily: "var(--font-body)" }}>
      
      {/* ================= CABECERA DE PANEL DE CONTROL ================= */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "hsl(var(--card))",
          padding: "20px 24px",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--card-border))",
          boxShadow: "var(--shadow-sm)"
        }}
        className="hidden-mobile"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Resumen de Operaciones</h3>
          <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))" }}>
            Monitoreo en tiempo real de ventas, inventario y alertas por sucursal.
          </p>
        </div>

        <SucursalSelector />

        {/* Contenedor relativo para Notificación (Campana de Alertas) */}
        <div style={{ position: "relative" }}>
          <button 
            type="button"
            onClick={() => setShowNotificationsModal(prev => !prev)}
            style={{
              position: "relative",
              background: countAlertas > 0 ? "rgba(225, 29, 72, 0.08)" : "rgba(15,23,42,0.04)",
              border: countAlertas > 0 ? "1px solid rgba(225, 29, 72, 0.2)" : "1px solid rgba(0,0,0,0.06)",
              borderRadius: "10px",
              cursor: "pointer",
              width: "42px",
              height: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: countAlertas > 0 ? "#e11d48" : "rgba(15,23,42,0.6)",
              transition: "all 0.2s ease",
            }}
            title="Notificaciones"
          >
            <Bell size={18} />
            {countAlertas > 0 && (
              <span style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "#e11d48",
                color: "#ffffff",
                fontSize: "0.58rem",
                fontWeight: 700,
                borderRadius: "9999px",
                width: countAlertas > 9 ? "auto" : "16px",
                minWidth: "16px",
                height: "16px",
                padding: countAlertas > 9 ? "0 4px" : "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 4px rgba(225, 29, 72, 0.3)",
                lineHeight: 1
              }}>
                {countAlertas}
              </span>
            )}
          </button>

          {/* MENÚ DE NOTIFICACIONES ALINEADO ABAJO */}
          {showNotificationsModal && (
            <>
              {/* Overlay invisible para cerrar al hacer clic afuera */}
              <div 
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 49,
                  background: "transparent",
                }}
                onClick={() => setShowNotificationsModal(false)}
              />
              
              {/* El panel/dropdown en sí */}
              <div 
                className="card animate-fade-in" 
                style={{ 
                  width: "380px", 
                  position: "absolute", 
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 50,
                  border: "1px solid rgba(15, 23, 42, 0.08)", 
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                  padding: "20px",
                  background: "#ffffff",
                  borderRadius: "12px",
                }}
              >
                <button 
                  onClick={() => setShowNotificationsModal(false)}
                  style={{ position: "absolute", top: "14px", right: "14px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={16} />
                </button>

                <h3 style={{ marginBottom: "14px", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
                  <Bell size={16} style={{ color: "#e11d48" }} />
                  Buzón de Alertas
                  {countAlertas > 0 && (
                    <span className="badge badge-danger" style={{ fontSize: "0.65rem", padding: "1px 5px", background: "rgba(225, 29, 72, 0.08)", color: "#e11d48", border: "1px solid rgba(225, 29, 72, 0.15)", borderRadius: "4px" }}>
                      {countAlertas} Nuevas
                    </span>
                  )}
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                  {countAlertas === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#64748b" }}>
                      <CheckCircle size={28} style={{ color: "#10b981", marginBottom: "6px" }} />
                      <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>¡Todo al día!</p>
                      <p style={{ fontSize: "0.75rem" }}>No hay alertas críticas.</p>
                    </div>
                  ) : (
                    activeAlertas.map((alerta) => {
                      const isDanger = alerta.tipo === "danger";
                      return (
                        <div 
                          key={alerta.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            padding: "10px",
                            borderRadius: "6px",
                            background: isDanger ? "rgba(225, 29, 72, 0.02)" : "rgba(245, 158, 11, 0.02)",
                            border: `1px solid ${isDanger ? "rgba(225, 29, 72, 0.08)" : "rgba(245, 158, 11, 0.08)"}`,
                            position: "relative"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ 
                              fontWeight: 600, 
                              fontSize: "0.65rem", 
                              textTransform: "uppercase", 
                              letterSpacing: "0.05em",
                              color: isDanger ? "#e11d48" : "#d97706",
                            }}>
                              {isDanger ? "Crítico" : "Advertencia"}
                            </span>
                          </div>

                          <p style={{ fontSize: "0.78rem", color: "#334155", margin: 0, fontWeight: 550, lineHeight: 1.35 }}>
                            {alerta.mensaje.replace("ALERTA DE SEGURIDAD: ", "").replace("ADVERTENCIA: ", "")}
                          </p>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                            <Link 
                              href={alerta.id === 3 ? "#seccion-reposicion" : "/admin/vencimiento"} 
                              onClick={() => setShowNotificationsModal(false)}
                              style={{ 
                                color: isDanger ? "#e11d48" : "#d97706",
                                fontSize: "0.72rem", 
                                fontWeight: 600, 
                                textDecoration: "underline",
                                textUnderlineOffset: "2px"
                              }}
                            >
                              {alerta.id === 3 ? "Ver stock crítico" : isDanger ? "Retirar lotes" : "Gestionar"}
                            </Link>
                            
                            <button
                              onClick={() => setAlertasDescartadas(prev => [...prev, alerta.id])}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                textDecoration: "underline",
                                padding: 0
                              }}
                            >
                              Descartar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>



      {/* ================= TELEMETRÍA METRICAS (KPI CARDS) ================= */}
      <div className="grid-4">
        {/* KPI 1: Ventas Hoy */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Ventas de Hoy
            </span>
            <div className="glow-icon glow-icon-primary" style={{ width: "38px", height: "38px" }}>
              <ShoppingBag size={18} style={{ color: "#e11d48" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
              {formatMoney(stats.ventasHoy)}
            </span>
            <span style={{ fontSize: "0.76rem", color: "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              Caja Consolidada Activa
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, marginBottom: "6px" }}>
              <span>Meta diaria: S/ 3,000</span>
              <span>{Math.min(100, Math.round((stats.ventasHoy / 3000) * 100))}%</span>
            </div>
            <div style={{ width: "100%", height: "4px", background: "rgba(0,0,0,0.04)", borderRadius: "2px", overflow: "hidden" }}>
              <div 
                style={{ 
                  width: `${Math.min(100, (stats.ventasHoy / 3000) * 100)}%`, 
                  height: "100%", 
                  background: "linear-gradient(90deg, #e11d48 0%, #ff4d6d 100%)",
                  borderRadius: "2px"
                }} 
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Stock Crítico */}
        <Link 
          href="#seccion-reposicion" 
          className="glass-card-premium hover-bounce" 
          style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px", textDecoration: "none", color: "inherit", cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Fórmula Crítica
            </span>
            <div 
              style={{ 
                width: "38px", 
                height: "38px", 
                borderRadius: "10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                background: stats.productosBajoStock > 0 ? "rgba(245, 158, 11, 0.08)" : "rgba(0,0,0,0.015)",
                color: stats.productosBajoStock > 0 ? "#d97706" : "rgba(15, 23, 42, 0.4)",
                border: stats.productosBajoStock > 0 ? "1px solid rgba(245, 158, 11, 0.15)" : "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <PackageX size={18} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
              {stats.productosBajoStock}
            </span>
            <span style={{ fontSize: "0.76rem", color: stats.productosBajoStock > 0 ? "#e11d48" : "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              {stats.productosBajoStock > 0 ? "Reposición Requerida" : "Stock Óptimo"}
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, marginBottom: "6px" }}>
              <span>Riesgo Abastecimiento</span>
              <span>{stats.productosBajoStock > 0 ? "ALERTA" : "0%"}</span>
            </div>
            <div style={{ width: "100%", height: "4px", background: "rgba(0,0,0,0.04)", borderRadius: "2px", overflow: "hidden" }}>
              <div 
                style={{ 
                  width: stats.productosBajoStock > 0 ? "85%" : "0%", 
                  height: "100%", 
                  background: stats.productosBajoStock > 0 ? "#f59e0b" : "#10b981",
                  borderRadius: "2px"
                }} 
              />
            </div>
          </div>
        </Link>

        {/* KPI 3: Lotes FIFO Alertas */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Lotes por Vencer
            </span>
            <div 
              style={{ 
                width: "38px", 
                height: "38px", 
                borderRadius: "10px", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                background: stats.lotesVencidos > 0 ? "rgba(225, 29, 72, 0.08)" : "rgba(245, 158, 11, 0.08)",
                color: stats.lotesVencidos > 0 ? "#e11d48" : "#d97706",
                border: stats.lotesVencidos > 0 ? "1px solid rgba(225, 29, 72, 0.15)" : "1px solid rgba(245, 158, 11, 0.15)",
              }}
            >
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
              {stats.lotesPorVencer}
            </span>
            <span style={{ fontSize: "0.76rem", color: stats.lotesVencidos > 0 ? "#e11d48" : "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              {stats.lotesVencidos > 0 ? `${stats.lotesVencidos} VENCIDOS` : "Sin Lotes Críticos"}
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, marginBottom: "6px" }}>
              <span>Riesgo Caducidad</span>
              <span>{stats.lotesVencidos > 0 ? "MÁXIMO" : stats.lotesPorVencer > 0 ? "BAJO" : "NULO"}</span>
            </div>
            <div style={{ width: "100%", height: "4px", background: "rgba(0,0,0,0.04)", borderRadius: "2px", overflow: "hidden" }}>
              <div 
                style={{ 
                  width: stats.lotesVencidos > 0 ? "100%" : stats.lotesPorVencer > 0 ? "35%" : "0%", 
                  height: "100%", 
                  background: stats.lotesVencidos > 0 ? "#e11d48" : "#f59e0b",
                  borderRadius: "2px"
                }} 
              />
            </div>
          </div>
        </div>

        {/* KPI 4: Arqueos */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Sobrantes de Caja
            </span>
            <div className="glow-icon glow-icon-success" style={{ width: "38px", height: "38px" }}>
              <DollarSign size={18} style={{ color: "#10b981" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "#10b981", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {formatMoney(stats.sobranteHoy)}
            </span>
            <span style={{ fontSize: "0.76rem", color: "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              Balance Físico del Día
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 600, marginBottom: "6px" }}>
              <span>Exactitud Contable</span>
              <span>100%</span>
            </div>
            <div style={{ width: "100%", height: "4px", background: "rgba(0,0,0,0.04)", borderRadius: "2px", overflow: "hidden" }}>
              <div 
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  background: "#10b981",
                  borderRadius: "2px"
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= REPORTES Y GRÁFICOS INTERACTIVOS (2 COLUMNAS) ================= */}
      <div className="grid-2">
        {/* Gráfico 1: Ventas Diarias */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a" }}>
                Ventas Diarias
              </h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(15, 23, 42, 0.5)", fontWeight: 500 }}>Ingresos del lunes al domingo</p>
            </div>
            <CustomSelect
              options={getSemanasDisponibles()}
              value={semanaOffset}
              onChange={setSemanaOffset}
              width="180px"
            />
          </div>

          <div style={{ height: "260px", width: "100%" }}>
            {!isMounted || loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)" }}>
                Cargando datos analíticos...
              </div>
            ) : chartSemanaData.every(d => d.ventas === 0) ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)", fontSize: "0.9rem" }}>
                No hay ventas registradas esta semana
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartSemanaData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(15, 23, 42, 0.4)" 
                    fontSize={11} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="rgba(15, 23, 42, 0.4)" 
                    fontSize={11} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => `S/ ${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: "#ffffff", 
                      border: "1px solid rgba(225, 29, 72, 0.15)", 
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#0f172a",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)"
                    }}
                    formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, "Total Venta"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#e11d48" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorVentas)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Ventas Mensuales */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a" }}>
                Ventas Mensuales
              </h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(15, 23, 42, 0.5)", fontWeight: 500 }}>Ingresos de enero a diciembre</p>
            </div>
            <CustomSelect
              options={getAnosDisponibles()}
              value={yearSeleccionado}
              onChange={setYearSeleccionado}
              width="180px"
            />
          </div>

          <div style={{ height: "260px", width: "100%" }}>
            {!isMounted || loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)" }}>
                Cargando datos analíticos...
              </div>
            ) : chartMensualData.every(d => d.ventas === 0) ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)", fontSize: "0.9rem" }}>
                No hay ventas registradas en el último año
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMensualData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMensual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(15, 23, 42, 0.4)" 
                    fontSize={10} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="rgba(15, 23, 42, 0.4)" 
                    fontSize={11} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => `S/ ${v}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: "#ffffff", 
                      border: "1px solid rgba(59, 130, 246, 0.15)", 
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#0f172a",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)"
                    }}
                    formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, "Total Venta"]}
                  />
                  <Bar 
                    dataKey="ventas" 
                    fill="url(#colorMensual)" 
                    radius={[6, 6, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ================= ANALÍTICA SECUNDARIA (PARTICIPACIÓN Y CATEGORÍAS) ================= */}
      <div className="grid-2">
        {/* Participación de Boticas */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "24px" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#0f172a" }}>
            {sucursalSeleccionada === "todos" ? "Participación de Boticas" : "Top Categorías"}
          </h3>

          <div style={{ height: "140px", width: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {!isMounted || loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)" }}>
                Procesando...
              </div>
            ) : sucursalSeleccionada === "todos" ? (
              breakdownSucursales.length === 0 ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)", fontSize: "0.85rem" }}>
                  Sin dispensaciones
                </div>
              ) : (
                <div style={{ display: "flex", height: "100%", alignItems: "center", gap: "12px" }}>
                  <div style={{ flex: 1.2, height: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={breakdownSucursales}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={54}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {breakdownSucursales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Leyenda */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", maxHeight: "120px" }}>
                    {breakdownSucursales.slice(0, 3).map((entry, index) => (
                      <div key={index} style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.68rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS[index % COLORS.length] }} />
                          <span style={{ color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "120px" }}>{entry.name}</span>
                        </div>
                        <span style={{ color: "rgba(15,23,42,0.5)", paddingLeft: "10px", fontWeight: 600 }}>
                          S/ {Number(entry.value).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              breakdownCategorias.length === 0 ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)", fontSize: "0.85rem" }}>
                  Sin datos en esta botica
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdownCategorias}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={54}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {breakdownCategorias.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        </div>

        {/* Distribución por Categorías */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "24px" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#0f172a" }}>
            Distribución por Categorías
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", maxHeight: "150px" }}>
            {breakdownCategorias.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: "rgba(15,23,42,0.4)", fontSize: "0.85rem" }}>
                Sin datos de categorías
              </div>
            ) : (
              (() => {
                const totalVentas = breakdownCategorias.reduce((acc, curr) => acc + curr.value, 0);
                return breakdownCategorias.map((cat, index) => {
                  const percentage = totalVentas > 0 ? (cat.value / totalVentas) * 100 : 0;
                  return (
                    <div key={index} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: 600 }}>
                        <span style={{ color: "#0f172a", textTransform: "capitalize" }}>{cat.name}</span>
                        <span style={{ color: "rgba(15, 23, 42, 0.5)" }}>
                          S/ {Number(cat.value).toFixed(0)} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.04)", borderRadius: "3px", overflow: "hidden" }}>
                        <div 
                          style={{ 
                            width: `${percentage}%`, 
                            height: "100%", 
                            background: COLORS[index % COLORS.length],
                            borderRadius: "3px",
                            transition: "width 0.5s ease-in-out"
                          }} 
                        />
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      </div>

      {/* ================= SECCIÓN DE CONTROL (VENTAS Y REPOSICIÓN) ================= */}
      <div id="seccion-reposicion" style={{ display: "flex", flexWrap: "wrap", gap: "24px", width: "100%", scrollMarginTop: "24px" }}>
        
        {/* Columna Izquierda: Tabla de auditoría de ventas */}
        <div className="glass-card-premium" style={{ flex: 1.6, minWidth: "320px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                Auditoría de Dispensaciones Recientes
              </h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(15,23,42,0.5)" }}>Últimas recetas y ventas autorizadas por el canal centralizado</p>
            </div>
            <Link
              href="/admin/ventas"
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#e11d48",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                textDecoration: "none"
              }}
              className="hover-bounce"
            >
              Libro de Ventas Completo
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="table-container" style={{ margin: 0, boxShadow: "none", border: "1px solid rgba(0,0,0,0.06)", flex: 1 }}>
            {ultimasVentas.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "rgba(15,23,42,0.4)", fontWeight: 700, fontSize: "0.9rem" }}>
                No se han registrado transacciones en esta sucursal hoy
              </div>
            ) : (
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>CÓDIGO</th>
                    <th>SUCURSAL</th>
                    <th>FÁRMACOS</th>
                    <th>FECHA/HORA</th>
                    <th>TOTAL</th>
                    <th>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasVentas.map((venta: any) => {
                    const itemsName = venta.detalles?.map((d: any) => d.producto?.nombre).join(", ");
                    const truncatedItems = itemsName && itemsName.length > 38 ? `${itemsName.substring(0, 36)}...` : itemsName;
                    const formattedDate = new Date(venta.fecha).toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    });

                    const isControlled = venta.detalles?.some((d: any) => d.producto?.categorias?.some((c: any) => c.nombre?.toLowerCase().includes("controlado") || c.nombre?.toLowerCase().includes("receta")));

                    return (
                      <tr key={venta.id}>
                        <td style={{ color: "#e11d48", fontWeight: 400 }}>#{venta.id || venta.codigoVenta || venta.id.toString().substring(0, 6)}</td>
                        <td>{venta.sucursal?.nombre?.replace("Botica Pharma Salud - ", "") || `Sucursal ${venta.sucursalId}`}</td>
                        <td style={{ color: "rgba(15,23,42,0.7)" }}>{truncatedItems || "General"}</td>
                        <td style={{ color: "rgba(15,23,42,0.45)", fontSize: "0.84rem" }}>{formattedDate}</td>
                        <td style={{ color: "#0f172a", fontWeight: 400 }}>{formatMoney(venta.total)}</td>
                        <td>
                          <span 
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.68rem",
                              fontWeight: 400,
                              padding: "4px 10px",
                              borderRadius: "6px",
                              background: isControlled ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)",
                              color: isControlled ? "#d97706" : "#10b981",
                              border: isControlled ? "1px solid rgba(245, 158, 11, 0.15)" : "1px solid rgba(16, 185, 129, 0.15)"
                            }}
                          >
                            <CheckCircle size={10} />
                            {isControlled ? "RECETA" : "LIBRE"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Columna Derecha: Lista de Reposición (Stock Crítico) */}
        <div className="glass-card-premium" style={{ flex: 1, minWidth: "300px", padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
                Lista de Reposición
              </h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(15,23,42,0.5)" }}>Medicamentos con stock crítico actual</p>
            </div>
            {productosBajoStockList.length > 0 && (
              <button
                className="btn btn-outline"
                onClick={handleExportReposicionPdf}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  borderColor: "#e11d48",
                  color: "#e11d48",
                  height: "32px",
                }}
              >
                <Download size={12} />
                <span>Reporte PDF</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "380px", overflowY: "auto", paddingRight: "4px", flex: 1 }}>
            {productosBajoStockList.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "rgba(15,23,42,0.4)", fontWeight: 700, fontSize: "0.9rem", margin: "auto" }}>
                <CheckCircle size={32} style={{ color: "#10b981", marginBottom: "8px", margin: "0 auto" }} />
                <p>¡Todo abastecido!</p>
                <p style={{ fontSize: "0.75rem", fontWeight: 500 }}>No hay productos bajo el stock mínimo.</p>
              </div>
            ) : (
              productosBajoStockList.map((inv: any) => {
                const sugerido = Math.max(0, (inv.stockMinimo * 2) - inv.cantidadTotal);
                return (
                  <div 
                    key={inv.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "rgba(225, 29, 72, 0.01)",
                      border: "1px solid rgba(225, 29, 72, 0.06)",
                      borderRadius: "10px",
                      gap: "12px"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 750, color: "#1e293b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "200px" }} title={inv.producto?.nombreProducto || "Fármaco"}>
                        {inv.producto?.nombreProducto || "Fármaco"}
                      </span>
                      <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>
                        Stock: <strong style={{ color: "#e11d48" }}>{inv.cantidadTotal} u.</strong> / Min: {inv.stockMinimo} u.
                      </span>
                    </div>
                    <span 
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background: "rgba(225, 29, 72, 0.08)",
                        color: "#e11d48",
                        border: "1px solid rgba(225, 29, 72, 0.15)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        whiteSpace: "nowrap"
                      }}
                    >
                      Pedir {sugerido} u.
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ================= MODULOS DE AUDITORÍA & COMPRAS ================= */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#0f172a" }}>
          Módulos de Auditoría & Farmacovigilancia
        </h3>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {/* Acción 1: Plan de compras */}
          <Link 
            href="/admin/analisis" 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "14px", 
              padding: "18px 20px", 
              borderRadius: "14px", 
              border: "1px solid rgba(0, 0, 0, 0.05)",
              background: "#ffffff",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.015)"
            }}
            className="hover-bounce"
          >
            <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(225, 29, 72, 0.06)", color: "#e11d48" }}>
              <TrendingUp size={18} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#0f172a" }}>Planificación de Stock</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(15,23,42,0.5)" }}>Predicciones de compra</span>
            </div>
          </Link>

          {/* Acción 2: Inventario Ajustes */}
          <Link 
            href="/admin/ajustes" 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "14px", 
              padding: "18px 20px", 
              borderRadius: "14px", 
              border: "1px solid rgba(0, 0, 0, 0.05)",
              background: "#ffffff",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.015)"
            }}
            className="hover-bounce"
          >
            <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.06)", color: "#3b82f6" }}>
              <Activity size={18} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#0f172a" }}>Auditoría Kardex Físico</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(15,23,42,0.5)" }}>Cuadres de stock y conciliación</span>
            </div>
          </Link>

          {/* Acción 3: Historial Exportación */}
          <Link 
            href="/admin/ventas" 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "14px", 
              padding: "18px 20px", 
              borderRadius: "14px", 
              border: "1px solid rgba(0, 0, 0, 0.05)",
              background: "#ffffff",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.015)"
            }}
            className="hover-bounce"
          >
            <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.06)", color: "#10b981" }}>
              <FileText size={18} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#0f172a" }}>Libro de Dispensación</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(15,23,42,0.5)" }}>Auditoría legal y reportes CSV</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Animaciones locales */}
      <style jsx>{`
        @keyframes spinIcon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        :global(.spin-icon) {
          animation: spinIcon 8s infinite linear;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        :global(.animate-fade-in) {
          animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div style={{ padding: "32px", color: "rgba(15,23,42,0.5)", fontWeight: 700 }}>Cargando consola analítica central...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
