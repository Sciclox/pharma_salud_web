"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Scale, FileText, CheckCircle2, AlertTriangle, Store, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import jsPDF from "jspdf";
import CustomSelect from "@/components/CustomSelect";
import SucursalSelector from "@/components/SucursalSelector";

interface InventarioItem {
  id: number;
  productoId: number;
  sucursalId: number;
  cantidadTotal: number; // Stock actual del sistema en unidades
  precioCaja: number;
  precioUnidad: number;
  costo: number;
  producto: {
    nombreProducto: string;
    categorias?: { nombre: string }[];
    cantidadPresentacion: number | null;
  };
}

interface Sucursal {
  id: number;
  nombre: string;
}

export default function AdminAjustes() {
  const searchParams = useSearchParams();
  const sucursalSeleccionada = searchParams.get("sucursalId") || "1";
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<InventarioItem[]>([]);
  
  // Tabla de Conteo Físico
  // Key: productoId, Value: cantidad física ingresada por el usuario (en unidades totales)
  const [conteoFisico, setConteoFisico] = useState<Record<number, string>>({});
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [ajustando, setAjustando] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar sucursales
  const fetchSucursales = useCallback(async () => {
    try {
      const res = await fetch("/api/sucursales");
      if (res.ok) {
        const data = await res.json();
        setSucursales(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Cargar inventario de la sucursal seleccionada
  const fetchInventario = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventarios?sucursalId=${sucursalSeleccionada}`);
      if (res.ok) {
        const data = await res.json();
        setInventario(data);
        setProductosFiltrados(data);

        // Inicializar el conteo físico con el stock actual del sistema
        const inicial: Record<number, string> = {};
        data.forEach((item: InventarioItem) => {
          inicial[item.productoId] = item.cantidadTotal.toString();
        });
        setConteoFisico(inicial);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [sucursalSeleccionada]);

  useEffect(() => {
    fetchSucursales();
    fetchInventario();
  }, [fetchSucursales, fetchInventario]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (!searchQuery) {
      setProductosFiltrados(inventario);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = inventario.filter(item => 
        item.producto.nombreProducto.toLowerCase().includes(query) ||
        (item.producto.categorias?.[0]?.nombre && item.producto.categorias[0].nombre.toLowerCase().includes(query))
      );
      setProductosFiltrados(filtered);
    }
  }, [searchQuery, inventario]);

  // Manejar el cambio de stock físico
  const handleConteoChange = (productoId: number, valor: string) => {
    setConteoFisico(prev => ({
      ...prev,
      [productoId]: valor,
    }));
  };

  // Calcular discrepancia en caliente
  const getDiscrepancia = (item: InventarioItem) => {
    const real = parseInt(conteoFisico[item.productoId] || "0");
    const sistema = item.cantidadTotal;
    return real - sistema; // Positivo = Sobrante, Negativo = Faltante
  };

  // Calcular valor monetario de la discrepancia (basado en costo unitario)
  const getValorDiscrepancia = (item: InventarioItem) => {
    const diff = getDiscrepancia(item);
    const costo = item.costo || 0.1;
    return diff * costo;
  };

  // Calcular balance económico total de la reconciliación
  const getBalanceTotal = () => {
    return inventario.reduce((acc, item) => acc + getValorDiscrepancia(item), 0);
  };

  // Aplicar Reconciliación de Inventario en el Servidor en Lote
  const handleAplicarAjustes = async () => {
    // Filtrar solo los productos que tengan diferencias
    const ajustes = inventario
      .map(item => {
        const diff = getDiscrepancia(item);
        const real = parseInt(conteoFisico[item.productoId] || "0");
        return {
          productoId: item.productoId,
          nombreProducto: item.producto.nombreProducto,
          sistema: item.cantidadTotal,
          real,
          diferencia: diff,
          valorDiferencia: getValorDiscrepancia(item),
        };
      })
      .filter(a => a.diferencia !== 0);

    if (ajustes.length === 0) {
      alert("No hay discrepancias registradas. El stock físico coincide al 100% con el sistema.");
      return;
    }

    const confirmed = await (window as any).showConfirm(`¿Está seguro de aplicar ajustes de stock para ${ajustes.length} medicamentos? Se actualizará el inventario físico de la sucursal, se crearán los registros de auditoría en Kardex y se registrará un balance de S/ ${getBalanceTotal().toFixed(2)} en la caja.`);
    if (!confirmed) {
      return;
    }

    setAjustando(true);
    try {
      // Registrar cada ajuste en la API de Kardex
      for (const aj of ajustes) {
        const tipoMov = aj.diferencia > 0 ? "Ajuste (+)" : "Ajuste (-)";
        await fetch("/api/kardex", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productoId: aj.productoId,
            sucursalId: parseInt(sucursalSeleccionada),
            tipoMovimiento: tipoMov,
            cantidad: Math.abs(aj.diferencia), // La API maneja la magnitud, el tipo da el sentido
            motivo: `Reconciliación Física: Stock anterior: ${aj.sistema}, Real: ${aj.real}`,
          }),
        });
      }

      // Si hay un impacto económico total diferente de cero, crear registro de discrepancia en la caja
      const balance = getBalanceTotal();
      if (balance !== 0) {
        await fetch("/api/sobrante-caja", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monto: balance,
            nota: `Ajuste Automático por Reconciliación Física de Inventario. Impacto de ${ajustes.length} medicamentos.`,
          }),
        });
      }

      // Generar Reporte de Ajustes en PDF
      generateAjustesPDF(ajustes, balance);

      alert("¡Ajustes aplicados correctamente en base de datos! Se ha descargado el informe de reconciliación.");
      fetchInventario(); // Recargar stock reconciliado

    } catch (error) {
      console.error("Error al aplicar ajustes:", error);
      alert("Error al procesar la reconciliación física de stock");
    } finally {
      setAjustando(false);
    }
  };

  // Generar Reporte PDF de Reconciliación
  const generateAjustesPDF = (ajustes: any[], balance: number) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");
    doc.setFontSize(16);

    const sNombre = sucursales.find(s => s.id === parseInt(sucursalSeleccionada))?.nombre || "Principal";

    doc.text("INFORME DE RECONCILIACIÓN FÍSICA DE INVENTARIO", 14, 15);
    doc.setFontSize(10);
    doc.text(`Sucursal auditada: ${sNombre}`, 14, 21);
    doc.text(`Fecha de Auditoría: ${new Date().toLocaleString()}`, 14, 25);
    doc.text("---------------------------------------------------------------------------------------------------", 14, 30);

    doc.setFontSize(10);
    doc.text("CANT DIF    SISTEMA    REAL    VALOR (S/)    MEDICAMENTO", 14, 36);
    doc.text("---------------------------------------------------------------------------------------------------", 14, 40);

    let y = 46;
    ajustes.forEach(aj => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const dif = (aj.diferencia > 0 ? `+${aj.diferencia}` : aj.diferencia.toString()).padEnd(10);
      const sis = aj.sistema.toString().padEnd(11);
      const rea = aj.real.toString().padEnd(8);
      const val = `S/ ${aj.valorDiferencia.toFixed(2)}`.padEnd(14);
      const name = aj.nombreProducto.substring(0, 36);
      doc.text(`${dif}  ${sis}  ${rea}  ${val}  ${name}`, 14, y);
      y += 7;
    });

    doc.text("---------------------------------------------------------------------------------------------------", 14, y + 2);
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`IMPACTO NETO EN CAJA: S/ ${balance.toFixed(2)}`, 14, y);
    doc.setFontSize(10);
    doc.text("Ajustes aplicados automáticamente en stocks y Kardex.", 14, y + 6);

    doc.save(`reporte_ajustes_inventario_sucursal_${sucursalSeleccionada}.pdf`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. SECCIÓN SUPERIOR: Controles */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          background: "hsl(var(--card))",
          padding: "20px 24px",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(var(--card-border))"
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <SucursalSelector />
        </div>

        {/* Balance Económico */}
        <div 
          style={{
            background: "hsl(var(--muted))",
            padding: "12px 24px",
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid hsl(var(--card-border))",
            display: "flex",
            alignItems: "end",
            justifyContent: "center",
            flexDirection: "column"
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>
            Descuadre Económico Estimado
          </span>
          <span 
            style={{ 
              fontSize: "1.3rem", 
              fontWeight: 600, 
              color: getBalanceTotal() >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))" 
            }}
          >
            {getBalanceTotal() >= 0 ? "+" : ""}{formatMoney(getBalanceTotal())}
          </span>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleAplicarAjustes}
          disabled={loading || ajustando}
          style={{ height: "44px" }}
        >
          <Scale size={16} />
          {ajustando ? "Procesando reconciliación..." : "Aplicar Reconciliación"}
        </button>
      </div>

      {/* 2. BÚSQUEDA RAPIDA */}
      <div style={{ position: "relative" }}>
        <input
          ref={searchInputRef}
          type="text"
          className="input-field"
          placeholder="Buscar medicamentos en stock para arqueo físico..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: "46px", paddingRight: "60px" }}
          disabled={ajustando}
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
        <div 
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(15, 23, 42, 0.05)",
            color: "#64748b",
            fontSize: "0.68rem",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "6px",
            pointerEvents: "none",
            userSelect: "none"
          }}
        >
          F1
        </div>
      </div>

      {/* 3. TABLA DE AJUSTES */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando inventarios físicos para auditoría...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th>Categoría</th>
                <th>Stock Sistema (unidades)</th>
                <th>Stock Físico (Entrada)</th>
                <th>Diferencia</th>
                <th>Valor Económico (Discrepancia)</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se registran medicamentos en el inventario.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((item) => {
                  const dif = getDiscrepancia(item);
                  const valorDif = getValorDiscrepancia(item);
                  
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 400 }}>{item.producto.nombreProducto}</td>
                      <td>
                        <span className="badge badge-info">{item.producto.categorias?.[0]?.nombre || "General"}</span>
                      </td>
                      <td style={{ fontWeight: 400 }}>{item.cantidadTotal} und</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          value={conteoFisico[item.productoId] || ""}
                          onChange={(e) => handleConteoChange(item.productoId, e.target.value)}
                          style={{
                            width: "100px",
                            padding: "6px 10px",
                            height: "34px",
                            textAlign: "center",
                            fontWeight: 700,
                          }}
                          disabled={ajustando}
                        />
                      </td>
                      <td 
                        style={{ 
                          fontWeight: 700, 
                          color: dif > 0 ? "hsl(var(--success))" : dif < 0 ? "hsl(var(--danger))" : "hsl(var(--foreground))" 
                        }}
                      >
                        {dif > 0 ? `+${dif}` : dif}
                      </td>
                      <td 
                        style={{ 
                          fontWeight: 700, 
                          color: valorDif > 0 ? "hsl(var(--success))" : valorDif < 0 ? "hsl(var(--danger))" : "hsl(var(--foreground))" 
                        }}
                      >
                        {valorDif > 0 ? "+" : ""}{formatMoney(valorDif)}
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
  );
}
