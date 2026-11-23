"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, TrendingUp, Package, AlertCircle, TrendingDown, RefreshCw, FileText, X, ArrowUpRight, BarChart3 } from "lucide-react";
import { formatMoney, formatDias, formatAgotamiento } from "@/lib/format";
import jsPDF from "jspdf";
import CustomSelect from "@/components/CustomSelect";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface AnalisisProducto {
  id: number;
  nombreProducto: string;
  categoriaNombre: string | null;
  stockUtil: number;
  stockUtilTxt: string;
  totalVendidas: number;
  tendencia: "EN AUMENTO" | "EN DESCENSO" | "ESTABLE";
  recomendacion: "URGENTE" | "SIN STOCK" | "POR AGOTARSE" | "REPOSICIÓN PREVENTIVA" | "ESTABLE" | "SOBRESTOCK" | "SIN MOVIMIENTO";
  diasRestantes: number;
  margenPorcentaje: number;
  compraMensualSugerida: number;
  compraSugeridaTxt: string;
  esTopVenta: boolean;
}

interface Sucursal {
  id: number;
  nombre: string;
}

export default function AdminAnalisis() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>("1");
  const [analisis, setAnalisis] = useState<AnalisisProducto[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<AnalisisProducto[]>([]);
  
  // Pestaña activa: "compras" | "top" | "rentabilidad" | "stagnant"
  const [activeTab, setActiveTab] = useState<string>("compras");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Detalle de producto lateral
  const [selectedProduct, setSelectedProduct] = useState<AnalisisProducto | null>(null);
  useEscapeToClose(!!selectedProduct, useCallback(() => setSelectedProduct(null), []));
  useBodyScrollLock(!!selectedProduct);

  // Cargar sucursales
  const fetchSucursales = useCallback(async () => {
    try {
      const res = await fetch("/api/sucursales");
      if (res.ok) {
        const data = await res.json();
        setSucursales(data);
        if (data.length > 0 && !sucursalSeleccionada) {
          setSucursalSeleccionada(data[0].id.toString());
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [sucursalSeleccionada]);

  // Cargar análisis predictivo desde el backend
  const fetchAnalisis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analisis?sucursalId=${sucursalSeleccionada}`);
      if (res.ok) {
        const data = await res.json();
        setAnalisis(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [sucursalSeleccionada]);

  useEffect(() => {
    fetchSucursales();
    fetchAnalisis();
  }, [fetchSucursales, fetchAnalisis]);

  // Filtrado y ordenamiento dinámico por pestaña
  const filterAndSort = useCallback(() => {
    let list = [...analisis];

    // Buscar coincidencia de nombre
    if (searchQuery) {
      list = list.filter(p => p.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Pestañas
    if (activeTab === "compras") {
      // 1. ¿Qué debo comprar? Filtrar recomendación crítica y sugeridos > 0
      list = list.filter(p => 
        p.compraMensualSugerida > 0 && 
        ["SIN STOCK", "URGENTE", "POR AGOTARSE", "REPOSICIÓN PREVENTIVA"].includes(p.recomendacion)
      );
      // Ordenar por nivel de urgencia: SIN STOCK (diasRestantes=0) -> URGENTE -> POR AGOTARSE -> REPOSICION PREVENTIVA
      const prioridad: Record<string, number> = {
        "SIN STOCK": 0,
        "URGENTE": 1,
        "POR AGOTARSE": 2,
        "REPOSICIÓN PREVENTIVA": 3,
      };
      list.sort((a, b) => (prioridad[a.recomendacion] ?? 4) - (prioridad[b.recomendacion] ?? 4));
    } else if (activeTab === "top") {
      // 2. Más Vendidos (totalVendidas desc)
      list = list.filter(p => p.totalVendidas > 0);
      list.sort((a, b) => b.totalVendidas - a.totalVendidas);
    } else if (activeTab === "rentabilidad") {
      // 3. Rentabilidad (margen desc)
      list = list.filter(p => p.margenPorcentaje > 0);
      list.sort((a, b) => b.margenPorcentaje - a.margenPorcentaje);
    } else if (activeTab === "stagnant") {
      // 4. Sin movimiento (totalVendidas = 0)
      list = list.filter(p => p.totalVendidas === 0);
    }

    setProductosFiltrados(list);
  }, [analisis, activeTab, searchQuery]);

  useEffect(() => {
    filterAndSort();
  }, [filterAndSort]);

  // Exportar Plan de Compras en PDF
  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");
    doc.setFontSize(18);

    // Titulo
    doc.text("PLAN DE COMPRAS SUGERIDAS (REPOSICIÓN)", 14, 15);
    doc.setFontSize(10);
    doc.text(`Sucursal: ${sucursales.find(s => s.id === parseInt(sucursalSeleccionada))?.nombre || "Principal"}`, 14, 21);
    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()}`, 14, 25);
    doc.text("---------------------------------------------------------------------------------------------------", 14, 30);

    // Filtrar a los recomendados
    const sugeridos = analisis.filter(p => 
      p.compraMensualSugerida > 0 && 
      ["SIN STOCK", "URGENTE", "POR AGOTARSE", "REPOSICIÓN PREVENTIVA"].includes(p.recomendacion)
    );

    doc.setFontSize(11);
    doc.text("CANT SUGERIDA    MEDICAMENTO                           PRIORIDAD       DÍAS REST", 14, 36);
    doc.text("---------------------------------------------------------------------------------------------------", 14, 40);

    let y = 46;
    if (sugeridos.length === 0) {
      doc.text("No se registran sugerencias de compra críticas para esta sucursal.", 14, y);
    } else {
      sugeridos.forEach(p => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const cant = p.compraSugeridaTxt.padEnd(16);
        const name = p.nombreProducto.substring(0, 34).padEnd(36);
        const reco = p.recomendacion.padEnd(20);
        const dias = p.diasRestantes === 0 ? "Agotado" : `${p.diasRestantes} días`;
        doc.text(`${cant}  ${name}  ${reco}  ${dias}`, 14, y);
        y += 7;
      });
    }

    doc.save(`plan_compras_sucursal_${sucursalSeleccionada}.pdf`);
  };

  return (
    <div style={{ display: "flex", flex: 1, gap: "24px" }}>
      {/* PANEL PRINCIPAL */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Encabezado del Análisis y Selector de Tienda */}
        <div 
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "hsl(var(--card))",
            padding: "20px 24px",
            borderRadius: "var(--radius)",
            border: "1px solid hsl(var(--card-border))"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Previsión de Inventarios</h3>
            <p style={{ fontSize: "0.85rem" }}>Analítica predictiva de velocidad de venta y volatilidad semanal.</p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <CustomSelect
              options={sucursales.map(s => ({ value: s.id.toString(), label: s.nombre }))}
              value={sucursalSeleccionada}
              onChange={setSucursalSeleccionada}
              width="220px"
            />

            <button className="btn btn-primary" onClick={handleExportPdf} style={{ display: "flex", gap: "8px" }}>
              <FileText size={16} />
              Exportar Plan PDF
            </button>
          </div>
        </div>

        {/* PESTAÑAS (4 Tabs) */}
        <div 
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1.5px solid hsl(var(--card-border))",
            paddingBottom: "2px"
          }}
        >
          <button 
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "compras" ? "3px solid hsl(var(--primary))" : "none",
              fontWeight: 700,
              cursor: "pointer",
              color: activeTab === "compras" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
            }}
            onClick={() => setActiveTab("compras")}
          >
            ¿Qué debo comprar?
          </button>
          <button 
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "top" ? "3px solid hsl(var(--primary))" : "none",
              fontWeight: 700,
              cursor: "pointer",
              color: activeTab === "top" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
            }}
            onClick={() => setActiveTab("top")}
          >
            Más Vendidos
          </button>
          <button 
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "rentabilidad" ? "3px solid hsl(var(--primary))" : "none",
              fontWeight: 700,
              cursor: "pointer",
              color: activeTab === "rentabilidad" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
            }}
            onClick={() => setActiveTab("rentabilidad")}
          >
            Rentabilidad
          </button>
          <button 
            style={{
              padding: "12px 20px",
              border: "none",
              background: "none",
              borderBottom: activeTab === "stagnant" ? "3px solid hsl(var(--primary))" : "none",
              fontWeight: 700,
              cursor: "pointer",
              color: activeTab === "stagnant" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
            }}
            onClick={() => setActiveTab("stagnant")}
          >
            Sin Movimiento
          </button>
        </div>

        {/* Buscador de Producto */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            className="input-field"
            placeholder="Buscar medicamentos analizados..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "46px" }}
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
        </div>

        {/* TABLA DE RESULTADOS ANALÍTICOS */}
        {loading ? (
          <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
            <p>Calculando matrices de consumo e inventario predictivo...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  {activeTab === "compras" && <th>Sugerido (Compra)</th>}
                  {activeTab === "top" && <th>Vendidos (12 Sem)</th>}
                  {activeTab === "rentabilidad" && <th>Rentabilidad (%)</th>}
                  <th>Stock Útil</th>
                  <th>Estado</th>
                  <th>Proyección (Días)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                      No se registraron datos para este filtro de análisis.
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((p) => {
                    const badgeClass = 
                      p.recomendacion === "URGENTE" || p.recomendacion === "SIN STOCK" ? "badge-danger" : 
                      p.recomendacion === "POR AGOTARSE" || p.recomendacion === "REPOSICIÓN PREVENTIVA" ? "badge-warning" : 
                      "badge-success";

                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 400 }}>
                          {p.nombreProducto}
                          {p.esTopVenta && (
                            <span 
                              style={{ 
                                background: "rgba(255, 51, 75, 0.1)", 
                                color: "hsl(var(--primary))",
                                fontSize: "0.65rem",
                                fontWeight: 400,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                marginLeft: "8px",
                                textTransform: "uppercase"
                              }}
                            >
                              Top Venta
                            </span>
                          )}
                        </td>
                        {activeTab === "compras" && (
                          <td style={{ fontWeight: 400, color: "hsl(var(--primary))" }}>
                            {p.compraSugeridaTxt}
                          </td>
                        )}
                        {activeTab === "top" && (
                          <td style={{ fontWeight: 400 }}>{p.totalVendidas} und</td>
                        )}
                        {activeTab === "rentabilidad" && (
                          <td style={{ fontWeight: 400, color: "hsl(var(--success))" }}>
                            {p.margenPorcentaje}%
                          </td>
                        )}
                        <td style={{ fontWeight: 400 }}>{p.stockUtilTxt}</td>
                        <td>
                          <span className={`badge ${badgeClass}`}>{p.recomendacion}</span>
                        </td>
                        <td style={{ fontWeight: 400 }}>{formatAgotamiento(p.diasRestantes)}</td>
                        <td>
                          <button 
                            className="btn btn-outline"
                            onClick={() => setSelectedProduct(p)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.8rem",
                              borderRadius: "var(--radius-sm)"
                            }}
                          >
                            Detalles
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

      {/* PANEL LATERAL FLOTANTE (Right Sheet Detail) */}
      {selectedProduct && (
        <div
          className="overlay-bg-blur"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            justifyContent: "end",
          }}
          onClick={() => setSelectedProduct(null)}
        >
          <div 
            className="slide-in"
            style={{
              width: "480px",
              height: "100%",
              background: "hsl(var(--card))",
              borderLeft: "1px solid hsl(var(--card-border))",
              padding: "40px 32px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()} // Evitar cerrar al hacer clic dentro
          >
            {/* Header del Panel */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Análisis de Medicamento</h3>
              <button 
                onClick={() => setSelectedProduct(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Medicamento */}
            <div style={{ borderBottom: "1.5px dashed hsl(var(--card-border))", paddingBottom: "20px" }}>
              <span style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase" }}>
                Medicamento catalogado
              </span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: "4px", color: "hsl(var(--primary))" }}>
                {selectedProduct.nombreProducto}
              </h2>
              <span className="badge badge-info" style={{ marginTop: "8px" }}>
                {selectedProduct.categoriaNombre || "General"}
              </span>
            </div>

            {/* Métricas clave */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
              
              {/* Sugerencia de compra */}
              <div 
                style={{ 
                  background: "hsl(var(--muted))", 
                  padding: "16px 20px", 
                  borderRadius: "var(--radius-sm)", 
                  border: "1.5px solid hsl(var(--card-border))",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
                    COMPRA SUGERIDA (MES):
                  </span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "hsl(var(--primary))" }}>
                    {selectedProduct.compraSugeridaTxt}
                  </span>
                </div>
                <span 
                  className={`badge ${selectedProduct.recomendacion === "URGENTE" || selectedProduct.recomendacion === "SIN STOCK" ? "badge-danger" : "badge-warning"}`}
                  style={{ fontSize: "0.75rem" }}
                >
                  {selectedProduct.recomendacion}
                </span>
              </div>

              {/* Grid 2x2 de datos */}
              <div className="grid-2">
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Stock Útil</span>
                  <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{selectedProduct.stockUtilTxt}</span>
                </div>
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Proyección Stock</span>
                  <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{formatAgotamiento(selectedProduct.diasRestantes)}</span>
                </div>
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Vendidos (12 Sem)</span>
                  <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{selectedProduct.totalVendidas} und</span>
                </div>
                <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>Margen Ganancia</span>
                  <span style={{ fontWeight: 600, fontSize: "1.1rem", color: "hsl(var(--success))" }}>{selectedProduct.margenPorcentaje}%</span>
                </div>
              </div>

              {/* Gráfico Analítico de Consumo placeholder */}
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <BarChart3 size={16} style={{ color: "hsl(var(--muted-foreground))" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>Tendencia de Consumo</span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Comportamiento:</span>
                  <span 
                    style={{ 
                      fontWeight: 600, 
                      color: selectedProduct.tendencia === "EN AUMENTO" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {selectedProduct.tendencia}
                    {selectedProduct.tendencia === "EN AUMENTO" && <ArrowUpRight size={16} />}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer del panel */}
            <button className="btn btn-secondary" onClick={() => setSelectedProduct(null)} style={{ width: "100%" }}>
              Cerrar Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
