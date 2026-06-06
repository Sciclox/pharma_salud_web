"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Upload, Download, Store, X, FileText, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface Product {
  id: number;
  nombreProducto: string;
  tipoProducto: string | null;
  cantidadPresentacion: number | null;
  cantidadPresentacionBlister: number | null;
  fechaCreacion: string;
  inventarios: {
    id: number;
    productoId: number;
    sucursalId: number;
    cantidadTotal: number;
    precioCaja: number;
    precioUnidad: number;
    costoCaja: number;
    costoUnidad: number;
    stockMinimo: number;
  }[];
}

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
}

export default function AdminProductos() {
  // Productos y Sucursales
  const [productos, setProductos] = useState<Product[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>("1"); // Sucursal principal por defecto
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todos");
  const [loading, setLoading] = useState<boolean>(true);

  // Modales - CRUD Producto Global
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [nombreProducto, setNombreProducto] = useState<string>("");
  const [tipoProducto, setTipoProducto] = useState<string>("Analgesicos");
  const [cantPresentacion, setCantPresentacion] = useState<string>("100");
  const [cantPresentacionBlister, setCantPresentacionBlister] = useState<string>("10");
  
  // Modales - Editar Precios/Stock por Sucursal
  const [selectedProductForInventory, setSelectedProductForInventory] = useState<Product | null>(null);
  const [cantidadTotal, setCantidadTotal] = useState<string>("0");
  const [precioCaja, setPrecioCaja] = useState<string>("0.00");
  const [precioUnidad, setPrecioUnidad] = useState<string>("0.00");
  const [costoCaja, setCostoCaja] = useState<string>("0.00");
  const [costoUnidad, setCostoUnidad] = useState<string>("0.00");
  const [stockMinimo, setStockMinimo] = useState<string>("0");

  // Modales - Importación CSV
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar sucursales para los selectores
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
      console.error("Error al cargar sucursales:", error);
    }
  }, [sucursalSeleccionada]);

  // Cargar productos del catálogo central con su stock
  const fetchProductos = useCallback(async () => {
    setLoading(true);
    try {
      // Cargamos todos los productos, y en el cliente filtramos por búsqueda
      const res = await fetch("/api/productos");
      if (res.ok) {
        const data = await res.json();
        setProductos(data);
      }
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSucursales();
    fetchProductos();
  }, [fetchSucursales, fetchProductos]);

  // 1. Registrar Producto en Catálogo Global
  const handleAddProduct = async () => {
    if (!nombreProducto.trim()) {
      alert("El nombre del producto es requerido");
      return;
    }

    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreProducto,
          tipoProducto,
          cantidadPresentacion: parseInt(cantPresentacion) || null,
          cantidadPresentacionBlister: parseInt(cantPresentacionBlister) || null,
        }),
      });

      if (res.ok) {
        setShowAddProductModal(false);
        setNombreProducto("");
        setCantPresentacion("100");
        setCantPresentacionBlister("10");
        fetchProductos(); // Recargar
      } else {
        const errData = await res.json();
        alert(`Error al registrar: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al registrar producto:", error);
    }
  };

  // 2. Abrir Modal de Inventario (Editar Stock/Precios de una sucursal específica)
  const handleOpenInventoryModal = (product: Product) => {
    setSelectedProductForInventory(product);
    
    // Buscar la fila de inventario de la sucursal seleccionada
    const sId = parseInt(sucursalSeleccionada);
    const inv = product.inventarios.find(i => i.sucursalId === sId);

    if (inv) {
      setCantidadTotal(inv.cantidadTotal.toString());
      setPrecioCaja(inv.precioCaja.toFixed(2));
      setPrecioUnidad(inv.precioUnidad.toFixed(2));
      setCostoCaja(inv.costoCaja.toFixed(2));
      setCostoUnidad(inv.costoUnidad.toFixed(2));
      setStockMinimo(inv.stockMinimo.toString());
    } else {
      // Inicializar en 0 si no existe la fila
      setCantidadTotal("0");
      setPrecioCaja("0.00");
      setPrecioUnidad("0.00");
      setCostoCaja("0.00");
      setCostoUnidad("0.00");
      setStockMinimo("0");
    }
  };

  // 3. Guardar Precios/Stock en la sucursal activa
  const handleSaveInventory = async () => {
    if (!selectedProductForInventory) return;

    try {
      const res = await fetch("/api/inventarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: selectedProductForInventory.id,
          sucursalId: parseInt(sucursalSeleccionada),
          cantidadTotal: parseInt(cantidadTotal),
          precioCaja: parseFloat(precioCaja),
          precioUnidad: parseFloat(precioUnidad),
          costoCaja: parseFloat(costoCaja),
          costoUnidad: parseFloat(costoUnidad),
          stockMinimo: parseInt(stockMinimo),
        }),
      });

      if (res.ok) {
        setSelectedProductForInventory(null);
        fetchProductos(); // Recargar catálogo con inventarios actualizados
      } else {
        alert("Error al actualizar precios e inventario");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 4. Eliminar Producto de Catálogo Global
  const handleDeleteProduct = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar este producto de forma física de todas las sucursales del catálogo central? Esta acción no se puede deshacer y borrará todo su stock asociado.")) {
      return;
    }

    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchProductos();
      } else {
        alert("Error al eliminar producto");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 5. Exportar Catálogo a CSV (Cliente)
  const handleExportCSV = () => {
    const headers = ["ID", "Medicamento", "Categoría", "Presentación Caja", "Presentación Blíster", "Stock Sucursal", "P. Caja", "P. Unidad"];
    const sId = parseInt(sucursalSeleccionada);

    const rows = productos.map(p => {
      const inv = p.inventarios.find(i => i.sucursalId === sId);
      return [
        p.id,
        `"${p.nombreProducto}"`,
        p.tipoProducto || "General",
        p.cantidadPresentacion || 0,
        p.cantidadPresentacionBlister || 0,
        inv ? inv.cantidadTotal : 0,
        inv ? inv.precioCaja : 0,
        inv ? inv.precioUnidad : 0
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventario_sucursal_${sucursalSeleccionada}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 6. Simular Importación CSV para Demo
  const handleImportCSV = () => {
    if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files.length > 0) {
      alert("CSV Procesado: 45 nuevos medicamentos agregados y stock de 120 actualizados (Simulado)");
      setShowImportModal(false);
      fetchProductos();
    } else {
      alert("Seleccione un archivo CSV primero");
    }
  };

  // Filtrado reactivo en cliente para velocidad instantánea
  const sIdActiva = parseInt(sucursalSeleccionada);
  const filteredProducts = productos.filter(p => {
    const matchesSearch = p.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tipoProducto && p.tipoProducto.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = categoriaSeleccionada === "todos" || 
      (p.tipoProducto && p.tipoProducto.toLowerCase() === categoriaSeleccionada.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. SECCIÓN SUPERIOR: Controles & Selectores */}
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
        {/* Selector de Sucursal y Categoría */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
              Sucursal a gestionar:
            </span>
            <select
              className="input-field"
              value={sucursalSeleccionada}
              onChange={(e) => setSucursalSeleccionada(e.target.value)}
              style={{ width: "220px", height: "42px", padding: "8px 12px" }}
            >
              {sucursales.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
              Categoría:
            </span>
            <select
              className="input-field"
              value={categoriaSeleccionada}
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              style={{ width: "180px", height: "42px", padding: "8px 12px" }}
            >
              <option value="todos">Todas</option>
              <option value="Analgesicos">Analgésicos</option>
              <option value="Antibioticos">Antibióticos</option>
              <option value="Antiinflamatorios">Antiinflamatorios</option>
              <option value="General">Otros / General</option>
            </select>
          </div>
        </div>

        {/* Botones de acción del catálogo */}
        <div style={{ display: "flex", gap: "12px", alignItems: "end" }}>
          <button className="btn btn-outline" onClick={() => setShowImportModal(true)} style={{ padding: "10px 16px" }}>
            <Upload size={16} />
            Importar CSV
          </button>
          
          <button className="btn btn-outline" onClick={handleExportCSV} style={{ padding: "10px 16px" }}>
            <Download size={16} />
            Exportar CSV
          </button>

          <button className="btn btn-primary" onClick={() => setShowAddProductModal(true)} style={{ padding: "10px 16px" }}>
            <Plus size={16} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* 2. SECCIÓN INTERMEDIA: Búsqueda reactiva */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Buscar medicamento en el catálogo central por nombre, código o laboratorio..."
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

      {/* 3. GRILLA DE PRODUCTOS */}
      {loading ? (
        <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
          <p>Cargando catálogo centralizado...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table-custom">
            <thead>
              <tr>
                <th>Medicamento</th>
                <th>Categoría</th>
                <th>Pres. Caja / Blíster</th>
                <th>Stock Físico (Sucursal)</th>
                <th>P. Caja (Sucursal)</th>
                <th>P. Unidad (Sucursal)</th>
                <th>Gestión Precios / Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
                    No se encontraron productos en el catálogo central.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const inv = p.inventarios.find(i => i.sucursalId === sIdActiva);
                  
                  // Formatear Stock en Cajas + Unidades
                  const factor = p.cantidadPresentacion || 1;
                  const totalUnidades = inv ? inv.cantidadTotal : 0;
                  const stockCajas = Math.floor(totalUnidades / factor);
                  const stockUnidades = totalUnidades % factor;
                  const stockTxt = inv ? `${stockCajas} cj + ${stockUnidades} und` : "0 cj + 0 und";
                  const stockMinimoNum = inv ? inv.stockMinimo : 0;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.nombreProducto}</td>
                      <td>
                        <span className="badge badge-info">{p.tipoProducto || "General"}</span>
                      </td>
                      <td style={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>
                        {p.cantidadPresentacion || 100} und / {p.cantidadPresentacionBlister || 10} und
                      </td>
                      <td>
                        <span 
                          className={`badge ${totalUnidades <= stockMinimoNum ? "badge-danger" : "badge-success"}`}
                          style={{ fontWeight: 700 }}
                        >
                          {stockTxt}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{inv ? formatMoney(inv.precioCaja) : "S/ 0.00"}</td>
                      <td style={{ fontWeight: 600 }}>{inv ? formatMoney(inv.precioUnidad) : "S/ 0.00"}</td>
                      <td>
                        <button 
                          className="btn btn-outline"
                          onClick={() => handleOpenInventoryModal(p)}
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.8rem",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          Editar Precios & Stock
                        </button>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            onClick={() => handleDeleteProduct(p.id)}
                            style={{ background: "none", border: "none", color: "hsl(var(--danger))", cursor: "pointer" }}
                            title="Eliminar del catálogo global"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Registrar Producto en Catálogo Global */}
      {showAddProductModal && (
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
          <div className="card" style={{ width: "500px", position: "relative" }}>
            <button 
              onClick={() => setShowAddProductModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>
              Registrar Nuevo Medicamento (Catálogo Central)
            </h3>

            <div className="form-group">
              <label className="form-label">Nombre del Producto:</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Paracetamol 500mg Genfar"
                value={nombreProducto}
                onChange={(e) => setNombreProducto(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Categoría:</label>
              <select
                className="input-field"
                value={tipoProducto}
                onChange={(e) => setTipoProducto(e.target.value)}
              >
                <option value="Analgesicos">Analgésicos</option>
                <option value="Antibioticos">Antibióticos</option>
                <option value="Antiinflamatorios">Antiinflamatorios</option>
                <option value="Vitaminas">Vitaminas</option>
                <option value="General">Otros / General</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Unidades por Caja:</label>
                <input
                  type="number"
                  className="input-field"
                  value={cantPresentacion}
                  onChange={(e) => setCantPresentacion(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Unidades por Blíster:</label>
                <input
                  type="number"
                  className="input-field"
                  value={cantPresentacionBlister}
                  onChange={(e) => setCantPresentacionBlister(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowAddProductModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleAddProduct} style={{ flex: 1 }}>
                Registrar Medicamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Editar Precios, Costos y Stock por Sucursal */}
      {selectedProductForInventory && (
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
          <div className="card" style={{ width: "550px", position: "relative" }}>
            <button 
              onClick={() => setSelectedProductForInventory(null)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>
              Gestionar Inventario & Precios
            </h3>
            <p style={{ fontWeight: 700, color: "hsl(var(--primary))", marginBottom: "20px" }}>
              {selectedProductForInventory.nombreProducto} 
              <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 500, fontSize: "0.85rem" }}>
                {" "}
                (Sucursal: {sucursales.find(s => s.id === sIdActiva)?.nombre})
              </span>
            </p>

            <div style={{ display: "flex", gap: "16px" }}>
              {/* Columna 1: Stock */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                <h4 style={{ fontSize: "0.9rem", borderBottom: "1px solid hsl(var(--card-border))", paddingBottom: "6px" }}>Stock Físico</h4>
                
                <div className="form-group">
                  <label className="form-label">Stock Total (Unidades):</label>
                  <input
                    type="number"
                    className="input-field"
                    value={cantidadTotal}
                    onChange={(e) => setCantidadTotal(e.target.value)}
                  />
                  <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                    Equivale a {Math.floor(parseInt(cantidadTotal || "0") / (selectedProductForInventory.cantidadPresentacion || 100))} cajas y {parseInt(cantidadTotal || "0") % (selectedProductForInventory.cantidadPresentacion || 100)} unidades.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Mínimo (Alerta):</label>
                  <input
                    type="number"
                    className="input-field"
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)}
                  />
                </div>
              </div>

              {/* Columna 2: Precios */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                <h4 style={{ fontSize: "0.9rem", borderBottom: "1px solid hsl(var(--card-border))", paddingBottom: "6px" }}>Precios & Costos (S/)</h4>
                
                <div style={{ display: "flex", gap: "12px" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Precio Caja:</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={precioCaja}
                      onChange={(e) => setPrecioCaja(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Precio Unidad:</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={precioUnidad}
                      onChange={(e) => setPrecioUnidad(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Costo Caja:</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={costoCaja}
                      onChange={(e) => setCostoCaja(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Costo Unidad:</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={costoUnidad}
                      onChange={(e) => setCostoUnidad(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setSelectedProductForInventory(null)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveInventory} style={{ flex: 1 }}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Importación CSV */}
      {showImportModal && (
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
          <div className="card" style={{ width: "450px", position: "relative", padding: "32px" }}>
            <button 
              onClick={() => setShowImportModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} />
            </button>

            <Upload size={48} style={{ color: "hsl(var(--primary))", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: "1.2rem", marginBottom: "8px", textAlign: "center" }}>Importar Catálogo desde CSV</h3>
            <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", marginBottom: "24px", textAlign: "center" }}>
              Seleccione un archivo CSV estructurado con columnas: Nombre, Categoría, Presentacion, PrecioCaja, PrecioUnidad, Costo.
            </p>

            <div className="form-group">
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                className="input-field"
                style={{ padding: "10px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button className="btn btn-outline" onClick={() => setShowImportModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleImportCSV} style={{ flex: 1 }}>
                Cargar Archivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
