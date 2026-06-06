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
  ShieldCheck,
  Server,
  Database,
  Thermometer,
  RefreshCw,
  CheckCircle,
  Building2
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

interface LogEvent {
  id: string;
  time: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}

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
  
  const [loading, setLoading] = useState<boolean>(true);
  const [alertasCriticas, setAlertasCriticas] = useState<any[]>([]);
  const [ventasData, setVentasData] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<string>("7D");
  const [logs, setLogs] = useState<LogEvent[]>([
    { id: "1", time: "19:28:10", type: "info", message: "Consola centralizada de trazabilidad inicializada." },
    { id: "2", time: "19:29:15", type: "success", message: "Enlace cifrado con base de datos establecido." },
    { id: "3", time: "19:30:04", type: "info", message: "Verificación automática de lotes finalizada. FIFO en cumplimiento." }
  ]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Simulación de Live Audit Event Logs
  useEffect(() => {
    if (!isMounted) return;
    const interval = setInterval(() => {
      const types: LogEvent["type"][] = ["info", "success", "warning"];
      const messages = [
        "Sensor de cadena de frío reportó 2.3°C (Refrigerador Bioléctrico 01).",
        "Dispensación autorizada para Paciente Ambulatorio.",
        "Auditoría de estupefacientes: libro firmado digitalmente.",
        "Sincronización de inventario finalizada en Sucursal Norte.",
        "Verificación de receta médica completada con éxito.",
        "Venta consolidada registrada en base de datos centralizada."
      ];
      
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];

      setLogs(prev => [
        {
          id: String(Date.now()),
          time: timeStr,
          type: randomType,
          message: randomMessage
        },
        ...prev.slice(0, 5)
      ]);
    }, 6000);

    return () => clearInterval(interval);
  }, [isMounted]);

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
        totalBajoStock = inventarios.filter((inv: any) => inv.cantidadTotal <= inv.stockMinimo).length;
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

  // Agrupar ventas
  const getVentasSemanaData = () => {
    const diasSemana = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const data = [];
    const hoy = new Date();
    const rangeLength = timeRange === "7D" ? 7 : timeRange === "30D" ? 30 : 90;
    
    for (let i = rangeLength - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(hoy.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const name = rangeLength === 7 ? diasSemana[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`;
      
      const totalDia = ventasData
        .filter((v: any) => v.fecha.startsWith(dateStr))
        .reduce((acc: number, v: any) => acc + v.total, 0);
        
      data.push({ name, ventas: totalDia });
    }
    return data;
  };

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
        const cat = d.producto?.tipoProducto || "General";
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

  const chartSemanaData = getVentasSemanaData();
  const breakdownSucursales = getSucursalesBreakdown();
  const breakdownCategorias = getCategoryBreakdown();

  const ultimasVentas = ventasData
    .slice()
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", fontFamily: "var(--font-body)" }}>
      
      {/* ================= TELEMETRÍA SUPERIOR CLINICA ================= */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#ffffff",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          borderRadius: "14px",
          padding: "14px 24px",
          boxShadow: "var(--shadow-sm)"
        }}
        className="hidden-mobile"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={14} style={{ color: "#e11d48" }} />
            <span style={{ fontSize: "0.76rem", color: "rgba(15,23,42,0.45)", fontWeight: 800 }}>AUDITORÍA DE ENLACE:</span>
            <span style={{ 
              fontSize: "0.7rem", 
              fontWeight: 900, 
              color: "#10b981", 
              background: "rgba(16, 185, 129, 0.08)", 
              padding: "2px 8px", 
              borderRadius: "4px"
            }}>
              SHA-256 CONECTADO
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "rgba(0,0,0,0.06)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Database size={14} style={{ color: "#e11d48" }} />
            <span style={{ fontSize: "0.76rem", color: "rgba(15,23,42,0.45)", fontWeight: 800 }}>TRAZABILIDAD DE STOCK:</span>
            <span style={{ fontSize: "0.76rem", color: "#0f172a", fontWeight: 900 }}>FIFO INTEGRADO</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", color: "rgba(15,23,42,0.45)", fontWeight: 800 }}>
          <RefreshCw size={12} className="spin-icon" style={{ color: "#e11d48" }} />
          <span>Sincronizado en vivo</span>
        </div>
      </div>

      {/* ================= SECCIÓN DE ALERTAS CRÍTICAS ================= */}
      {alertasCriticas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {alertasCriticas.map((alerta) => (
            <div 
              key={alerta.id} 
              className="pulse-alert"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 24px",
                borderRadius: "14px",
                background: alerta.tipo === "danger" ? "rgba(225, 29, 72, 0.04)" : "rgba(245, 158, 11, 0.04)",
                border: `1px solid ${alerta.tipo === "danger" ? "rgba(225, 29, 72, 0.15)" : "rgba(245, 158, 11, 0.15)"}`,
                color: alerta.tipo === "danger" ? "#e11d48" : "#d97706",
              }}
            >
              <AlertOctagon size={22} style={{ flexShrink: 0, color: alerta.tipo === "danger" ? "#e11d48" : "#f59e0b" }} />
              <div style={{ flex: 1, fontSize: "0.92rem", fontWeight: 800 }}>
                {alerta.mensaje}
              </div>
              <Link 
                href="/admin/vencimiento" 
                style={{ 
                  color: "#fff",
                  background: alerta.tipo === "danger" ? "#e11d48" : "#f59e0b",
                  fontSize: "0.78rem", 
                  fontWeight: 900, 
                  padding: "8px 16px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: alerta.tipo === "danger" ? "0 4px 12px rgba(225, 29, 72, 0.2)" : "none"
                }}
                className="hover-bounce"
              >
                {alerta.tipo === "danger" ? "Retiro Inmediato" : "Revisar Lotes"}
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ================= TELEMETRÍA METRICAS (KPI CARDS) ================= */}
      <div className="grid-4">
        {/* KPI 1: Ventas Hoy */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 900, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Ventas de Hoy
            </span>
            <div className="glow-icon glow-icon-primary" style={{ width: "38px", height: "38px" }}>
              <ShoppingBag size={18} style={{ color: "#e11d48" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
              {formatMoney(stats.ventasHoy)}
            </span>
            <span style={{ fontSize: "0.76rem", color: "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              Caja Consolidada Activa
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 800, marginBottom: "6px" }}>
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
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 900, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
            <span style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
              {stats.productosBajoStock}
            </span>
            <span style={{ fontSize: "0.76rem", color: stats.productosBajoStock > 0 ? "#e11d48" : "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              {stats.productosBajoStock > 0 ? "⚠️ Reposición Requerida" : "Stock Óptimo"}
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 800, marginBottom: "6px" }}>
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
        </div>

        {/* KPI 3: Lotes FIFO Alertas */}
        <div className="glass-card-premium" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 900, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
            <span style={{ fontSize: "2rem", fontWeight: 950, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
              {stats.lotesPorVencer}
            </span>
            <span style={{ fontSize: "0.76rem", color: stats.lotesVencidos > 0 ? "#e11d48" : "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              {stats.lotesVencidos > 0 ? `⚠️ ${stats.lotesVencidos} VENCIDOS` : "Sin Lotes Críticos"}
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 800, marginBottom: "6px" }}>
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
            <span style={{ color: "rgba(15, 23, 42, 0.45)", fontWeight: 900, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Sobrantes de Caja
            </span>
            <div className="glow-icon glow-icon-success" style={{ width: "38px", height: "38px" }}>
              <DollarSign size={18} style={{ color: "#10b981" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "2rem", fontWeight: 950, color: "#10b981", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {formatMoney(stats.sobranteHoy)}
            </span>
            <span style={{ fontSize: "0.76rem", color: "rgba(15, 23, 42, 0.4)", fontWeight: 700 }}>
              Balance Físico del Día
            </span>
          </div>
          <div style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "rgba(15, 23, 42, 0.45)", fontWeight: 800, marginBottom: "6px" }}>
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

      {/* ================= REPORTES Y GRÁFICOS INTERACTIVOS (3 COLUMNAS) ================= */}
      <div className="grid-3">
        {/* Gráfico 1: Ventas Semanales */}
        <div className="glass-card-premium" style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: "24px", padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 950, letterSpacing: "-0.02em", color: "#0f172a" }}>
                Flujo de Dispensación y Demanda
              </h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(15, 23, 42, 0.5)", fontWeight: 500 }}>Monitoreo analítico de stock dispensado</p>
            </div>
            <div style={{ display: "flex", background: "rgba(0,0,0,0.02)", padding: "4px", borderRadius: "10px", border: "1px solid rgba(0,0,0,0.05)" }}>
              {["7D", "30D", "90D"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  style={{
                    background: timeRange === range ? "#e11d48" : "none",
                    border: "none",
                    color: timeRange === range ? "#fff" : "rgba(15,23,42,0.55)",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    padding: "6px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: "260px", width: "100%" }}>
            {!isMounted || loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)" }}>
                Cargando datos analíticos...
              </div>
            ) : chartSemanaData.every(d => d.ventas === 0) ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(15, 23, 42, 0.4)", fontSize: "0.9rem" }}>
                No hay ventas registradas en este período
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

        {/* Column 3: Mini-charts + Live log */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Participación de Boticas */}
          <div className="glass-card-premium" style={{ flex: 1.1, display: "flex", flexDirection: "column", gap: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 950, letterSpacing: "-0.01em", color: "#0f172a" }}>
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
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 800 }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS[index % COLORS.length] }} />
                            <span style={{ color: "#0f172a", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "80px" }}>{entry.name}</span>
                          </div>
                          <span style={{ color: "rgba(15,23,42,0.5)", paddingLeft: "10px", fontWeight: 800 }}>
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

          {/* Logs / Bitácora de Farmacovigilancia en Claro */}
          <div className="glass-card-premium" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: "8px" }}>
              <ShieldCheck size={14} style={{ color: "#e11d48" }} />
              <span style={{ fontSize: "0.72rem", color: "rgba(15,23,42,0.5)", fontWeight: 800, letterSpacing: "0.08em" }}>
                BITÁCORA EN TIEMPO REAL
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
              {logs.map((log) => (
                <div key={log.id} style={{ display: "flex", gap: "8px", fontSize: "0.68rem", lineHeight: 1.3 }} className="fade-in">
                  <span style={{ color: "#e11d48", fontWeight: 800 }}>[{log.time}]</span>
                  <span style={{ color: "rgba(15,23,42,0.65)", fontWeight: 600 }}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= TABLA DE AUDITORÍA DE ÚLTIMAS VENTAS (Tema Claro) ================= */}
      <div className="glass-card-premium" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 950, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Auditoría de Dispensaciones Recientes
            </h3>
            <p style={{ fontSize: "0.78rem", color: "rgba(15,23,42,0.5)" }}>Últimas recetas y ventas autorizadas por el canal centralizado</p>
          </div>
          <Link
            href="/admin/ventas"
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
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

        <div className="table-container" style={{ margin: 0, boxShadow: "none", border: "1px solid rgba(0,0,0,0.06)" }}>
          {ultimasVentas.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "rgba(15,23,42,0.4)", fontWeight: 700, fontSize: "0.9rem" }}>
              No se han registrado transacciones en esta sucursal hoy
            </div>
          ) : (
            <table className="table-custom">
              <thead>
                <tr>
                  <th>CÓDIGO</th>
                  <th>SUCURSAL / BOTICA</th>
                  <th>FÁRMACOS</th>
                  <th>FECHA/HORA</th>
                  <th>TOTAL</th>
                  <th>ESTADO DE DISPENSACIÓN</th>
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

                  const isControlled = venta.detalles?.some((d: any) => d.producto?.tipoProducto?.toLowerCase().includes("controlado") || d.producto?.tipoProducto?.toLowerCase().includes("receta"));

                  return (
                    <tr key={venta.id}>
                      <td style={{ color: "#e11d48", fontWeight: 800 }}>#{venta.id || venta.codigoVenta || venta.id.toString().substring(0, 6)}</td>
                      <td>{venta.sucursal?.nombre?.replace("Botica Pharma Salud - ", "") || `Sucursal ${venta.sucursalId}`}</td>
                      <td style={{ color: "rgba(15,23,42,0.7)" }}>{truncatedItems || "General"}</td>
                      <td style={{ color: "rgba(15,23,42,0.45)", fontSize: "0.84rem" }}>{formattedDate}</td>
                      <td style={{ color: "#0f172a", fontWeight: 800 }}>{formatMoney(venta.total)}</td>
                      <td>
                        <span 
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: isControlled ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)",
                            color: isControlled ? "#d97706" : "#10b981",
                            border: isControlled ? "1px solid rgba(245, 158, 11, 0.15)" : "1px solid rgba(16, 185, 129, 0.15)"
                          }}
                        >
                          <CheckCircle size={10} />
                          {isControlled ? "RECETA RETENIDA" : "VERIFICADO - LIBRE"}
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

      {/* ================= MODULOS DE AUDITORÍA & COMPRAS ================= */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 900, letterSpacing: "-0.01em", color: "#0f172a" }}>
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
              <span style={{ fontWeight: 850, fontSize: "0.95rem", color: "#0f172a" }}>Planificación de Stock</span>
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
              <span style={{ fontWeight: 850, fontSize: "0.95rem", color: "#0f172a" }}>Auditoría Kardex Físico</span>
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
              <span style={{ fontWeight: 850, fontSize: "0.95rem", color: "#0f172a" }}>Libro de Dispensación</span>
              <span style={{ fontSize: "0.75rem", color: "rgba(15,23,42,0.5)" }}>Auditoría legal y reportes CSV</span>
            </div>
          </Link>
        </div>
      </div>
      
      {/* Animaciones locales */}
      <style jsx>{`
        @keyframes pulseAlert {
          0% { box-shadow: 0 0 12px rgba(225, 29, 72, 0.06); border-color: rgba(225, 29, 72, 0.25); }
          50% { box-shadow: 0 0 20px rgba(225, 29, 72, 0.18); border-color: rgba(225, 29, 72, 0.4); }
          100% { box-shadow: 0 0 12px rgba(225, 29, 72, 0.06); border-color: rgba(225, 29, 72, 0.25); }
        }
        :global(.pulse-alert) {
          animation: pulseAlert 2.5s infinite ease-in-out;
        }
        @keyframes spinIcon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        :global(.spin-icon) {
          animation: spinIcon 8s infinite linear;
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
