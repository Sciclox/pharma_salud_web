"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Plus, Edit2, Trash2, Upload, Download, Store, X, FileText, CheckCircle2, Package, AlertTriangle, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface Product {
  id: number;
  nombreProducto: string;
  categoriaId: number | null;
  laboratorioId: number | null;
  laboratorio?: { id: number; nombre: string } | null;
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
  const searchParams = useSearchParams();
  const sucursalSeleccionada = searchParams.get("sucursalId") || "todos";

  // Productos y Sucursales
  const [productos, setProductos] = useState<Product[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [laboratorios, setLaboratorios] = useState<{ id: number; nombre: string }[]>([]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todos");
  const [laboratorioSeleccionado, setLaboratorioSeleccionado] = useState<string>("todos");
  const [loading, setLoading] = useState<boolean>(true);
  const [laboratorioLoading, setLaboratorioLoading] = useState<boolean>(false);

  // Modales - CRUD Producto Global (Nuevo)
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [nombreProducto, setNombreProducto] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [laboratorioId, setLaboratorioId] = useState<string>("");
  const [cantPresentacion, setCantPresentacion] = useState<string>("100");
  const [cantPresentacionBlister, setCantPresentacionBlister] = useState<string>("10");

  // Modales - CRUD Producto Global (Editar)
  const [showEditProductModal, setShowEditProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editNombreProducto, setEditNombreProducto] = useState<string>("");
  const [editCategoriaId, setEditCategoriaId] = useState<string>("");
  const [editLaboratorioId, setEditLaboratorioId] = useState<string>("");
  const [editCantPresentacion, setEditCantPresentacion] = useState<string>("100");
  const [editCantPresentacionBlister, setEditCantPresentacionBlister] = useState<string>("10");

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

  // Ref de búsqueda para atajo
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cargar sucursales para los selectores
  const fetchSucursales = useCallback(async () => {
    try {
      const res = await fetch("/api/sucursales");
      if (res.ok) {
        const data = await res.json();
        setSucursales(data);
      }
    } catch (error) {
      console.error("Error al cargar sucursales:", error);
    }
  }, []);

  // Cargar productos del catálogo central con su stock
  const [categoriaLoading, setCategoriaLoading] = useState<boolean>(false);
  const fetchProductos = useCallback(async () => {
    setLoading(true);
    try {
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

  // Cargar categorías dinámicas
  const fetchCategorias = useCallback(async () => {
    setCategoriaLoading(true);
    try {
      const res = await fetch("/api/categorias");
      if (res.ok) {
        const data = await res.json();
        setCategorias(data);
        if (data.length > 0) {
          setCategoriaId(data[0].id.toString());
        }
      }
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    } finally {
      setCategoriaLoading(false);
    }
  }, []);

  // Cargar laboratorios dinámicos
  const fetchLaboratorios = useCallback(async () => {
    setLaboratorioLoading(true);
    try {
      const res = await fetch("/api/laboratorios");
      if (res.ok) {
        const data = await res.json();
        setLaboratorios(data);
        if (data.length > 0) {
          setLaboratorioId(data[0].id.toString());
        }
      }
    } catch (error) {
      console.error("Error al cargar laboratorios:", error);
    } finally {
      setLaboratorioLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSucursales();
    fetchProductos();
    fetchCategorias();
    fetchLaboratorios();
  }, [fetchSucursales, fetchProductos, fetchCategorias, fetchLaboratorios]);

  // Atajo de teclado Ctrl + K para enfocar el buscador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
          categoriaId: categoriaId ? parseInt(categoriaId) : null,
          laboratorioId: laboratorioId ? parseInt(laboratorioId) : null,
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

  // 1.5 Abrir modal de edición global
  const handleOpenEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setEditNombreProducto(product.nombreProducto);
    setEditCategoriaId(product.categoriaId?.toString() || (categorias.length > 0 ? categorias[0].id.toString() : ""));
    setEditLaboratorioId(product.laboratorioId?.toString() || (laboratorios.length > 0 ? laboratorios[0].id.toString() : ""));
    setEditCantPresentacion(product.cantidadPresentacion?.toString() || "100");
    setEditCantPresentacionBlister(product.cantidadPresentacionBlister?.toString() || "10");
    setShowEditProductModal(true);
  };

  // 1.6 Guardar Cambios del Producto Global
  const handleSaveEditProduct = async () => {
    if (!editNombreProducto.trim()) {
      alert("El nombre del producto es requerido");
      return;
    }

    try {
      const res = await fetch(`/api/productos/${editingProduct?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreProducto: editNombreProducto,
          categoriaId: editCategoriaId ? parseInt(editCategoriaId) : null,
          laboratorioId: editLaboratorioId ? parseInt(editLaboratorioId) : null,
          cantidadPresentacion: parseInt(editCantPresentacion) || null,
          cantidadPresentacionBlister: parseInt(editCantPresentacionBlister) || null,
        }),
      });

      if (res.ok) {
        setShowEditProductModal(false);
        setEditingProduct(null);
        fetchProductos(); // Recargar
      } else {
        const errData = await res.json();
        alert(`Error al guardar: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al editar producto:", error);
    }
  };

  // Obtener el ID de la sucursal activa de forma segura
  const getActiveSucursalId = () => {
    const sId = parseInt(sucursalSeleccionada);
    if (!isNaN(sId) && sucursales.some(s => s.id === sId)) {
      return sId;
    }
    return sucursales.length > 0 ? sucursales[0].id : 1;
  };

  // Helper: ¿está activo el modo consolidado (todas las sucursales)?
  const isModoGlobal = sucursalSeleccionada === "todos";

  // 2. Abrir Modal de Inventario (Editar Stock/Precios de una sucursal específica)
  const handleOpenInventoryModal = (product: Product) => {
    setSelectedProductForInventory(product);

    if (isModoGlobal) {
      // En modo global cargamos los precios de la primera sucursal como referencia
      const ref = product.inventarios[0];
      if (ref) {
        setCantidadTotal("0"); // stock no aplica en global
        setPrecioCaja(ref.precioCaja.toFixed(2));
        setPrecioUnidad(ref.precioUnidad.toFixed(2));
        setCostoCaja(ref.costoCaja.toFixed(2));
        setCostoUnidad(ref.costoUnidad.toFixed(2));
        setStockMinimo(ref.stockMinimo.toString());
      } else {
        setCantidadTotal("0");
        setPrecioCaja("0.00");
        setPrecioUnidad("0.00");
        setCostoCaja("0.00");
        setCostoUnidad("0.00");
        setStockMinimo("0");
      }
      return;
    }

    // Buscar la fila de inventario de la sucursal seleccionada
    const sId = getActiveSucursalId();
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

  // 3. Guardar Precios/Stock en la sucursal activa (o en todas si modo global)
  const handleSaveInventory = async () => {
    if (!selectedProductForInventory) return;

    // En modo global enviamos "todos"; la API aplica cambios a todas las sucursales
    const sucursalIdPayload = isModoGlobal ? "todos" : getActiveSucursalId();

    try {
      const body: Record<string, unknown> = {
        productoId: selectedProductForInventory.id,
        sucursalId: sucursalIdPayload,
        precioCaja: parseFloat(precioCaja),
        precioUnidad: parseFloat(precioUnidad),
        costoCaja: parseFloat(costoCaja),
        costoUnidad: parseFloat(costoUnidad),
        stockMinimo: parseInt(stockMinimo),
      };

      // Solo incluir cantidadTotal en modo local
      if (!isModoGlobal) {
        body.cantidadTotal = parseInt(cantidadTotal);
      }

      const res = await fetch("/api/inventarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    const headers = ["ID", "Medicamento", "Categoría ID", "Presentación Caja", "Presentación Blíster", "Stock Sucursal", "P. Caja", "P. Unidad"];
    const sId = parseInt(sucursalSeleccionada);

    const rows = productos.map(p => {
      const inv = p.inventarios.find(i => i.sucursalId === sId);
      return [
        p.id,
        `"${p.nombreProducto}"`,
        p.categoriaId || 0,
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
  const sIdActiva = sucursalSeleccionada === "todos" ? null : parseInt(sucursalSeleccionada);

  const filteredProducts = productos.filter(p => {
    const productCategory = categorias.find(c => c.id === p.categoriaId);
    const categoryName = productCategory ? productCategory.nombre : "";

    const matchesSearch = p.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.laboratorio?.nombre && p.laboratorio.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoriaSeleccionada === "todos" ||
      categoryName.toLowerCase() === categoriaSeleccionada.toLowerCase();

    const matchesLaboratorio = laboratorioSeleccionado === "todos" ||
      p.laboratorioId === parseInt(laboratorioSeleccionado);

    return matchesSearch && matchesCategory && matchesLaboratorio;
  });

  return (
    <>
      <div className="admin-products-root">
        {/* 1. CABECERA: Título y Acciones Globales */}
        <div className="admin-header-row">
          <div>
            <h1 className="admin-page-title">Inventario Central</h1>
            <p className="admin-page-subtitle">Panel global de auditoría, precios y existencias en tiempo real.</p>
          </div>
          <div className="admin-header-actions">
            <button className="btn btn-outline" onClick={() => setShowImportModal(true)}>
              <Upload size={14} strokeWidth={2.5} />
              <span>Importar CSV</span>
            </button>
            <button className="btn btn-outline" onClick={handleExportCSV}>
              <Download size={14} strokeWidth={2.5} />
              <span>Exportar CSV</span>
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddProductModal(true)}>
              <Plus size={14} strokeWidth={2.5} />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* 3. BARRA DE FILTROS Y BÚSQUEDA INTEGRADA Y PREMIUM */}
        <div className="admin-filter-card" style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "stretch" }}>
          <div className="admin-search-box-wrap" style={{ flex: 1 }}>
            <Search size={18} className="admin-search-icon" strokeWidth={2.2} />
            <input
              ref={searchInputRef}
              type="text"
              className="admin-search-input"
              placeholder="Buscar medicamento en el catálogo central..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="admin-search-shortcut-badge">Ctrl K</div>
            {searchQuery && (
              <button className="admin-search-clear-btn" onClick={() => setSearchQuery("")} style={{ right: "62px" }}>
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px", padding: "0 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                Categoría Terapéutica:
              </label>
              <select
                className="input-field"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                style={{
                  width: "220px",
                  height: "38px",
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: 650,
                  borderRadius: "var(--radius-sm)",
                  border: "1.5px solid hsl(var(--card-border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="todos">Todas las categorías</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.nombre}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                Laboratorio:
              </label>
              <select
                className="input-field"
                value={laboratorioSeleccionado}
                onChange={(e) => setLaboratorioSeleccionado(e.target.value)}
                style={{
                  width: "220px",
                  height: "38px",
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: 650,
                  borderRadius: "var(--radius-sm)",
                  border: "1.5px solid hsl(var(--card-border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="todos">Todos los laboratorios</option>
                {laboratorios.map(lab => (
                  <option key={lab.id} value={lab.id.toString()}>
                    {lab.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. TABLA DE PRODUCTOS REDISEÑADA (SaaS Row & Progress Bar) */}
        {loading ? (
          <div style={{ display: "flex", height: "200px", alignItems: "center", justifyContent: "center" }}>
            <p>Cargando catálogo centralizado...</p>
          </div>
        ) : (
          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Laboratorio</th>
                    <th>Caja / Blíster</th>
                    <th className="text-center" style={{ width: "180px" }}>Stock Físico (Sucursal)</th>
                    <th className="text-right">Precio Caja</th>
                    <th className="text-right">Precio Unidad</th>
                    <th className="text-center">Gestión</th>
                    <th className="text-center">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="admin-table-empty">
                        <div className="admin-empty-state">
                          <Package size={40} className="admin-empty-icon" />
                          <p>No se encontraron productos en el catálogo central.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const inv = sIdActiva === null ? null : p.inventarios.find(i => i.sucursalId === sIdActiva);
                      const factor = p.cantidadPresentacion || 1;
                      const totalUnidades = sIdActiva === null
                        ? p.inventarios.reduce((acc, curr) => acc + curr.cantidadTotal, 0)
                        : (inv ? inv.cantidadTotal : 0);
                      const stockCajas = Math.floor(totalUnidades / factor);
                      const stockUnidades = totalUnidades % factor;

                      const stockTxt = `${stockCajas} cj + ${stockUnidades} und`;
                      const stockMinimoNum = sIdActiva === null
                        ? p.inventarios.reduce((acc, curr) => acc + curr.stockMinimo, 0)
                        : (inv ? inv.stockMinimo : 0);

                      // Criterios de alertas
                      const isCritical = totalUnidades <= stockMinimoNum;
                      const isWarning = totalUnidades > stockMinimoNum && totalUnidades <= stockMinimoNum * 1.5;

                      // Calcular porcentaje de stock con un tope virtual de 2 veces el stock mínimo
                      const targetStock = stockMinimoNum > 0 ? stockMinimoNum * 2 : 10;
                      const stockPct = Math.min(100, (totalUnidades / targetStock) * 100);

                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="admin-prod-cell">
                              <span className="admin-prod-name">{p.nombreProducto}</span>
                              <span className="admin-prod-meta">
                                Código: #{p.id} · Creado: {new Date(p.fechaCreacion).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="admin-badge badge-lab">{p.laboratorio?.nombre || "Sin lab"}</span>
                          </td>
                          <td className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                            {p.cantidadPresentacion || 100} u. / {p.cantidadPresentacionBlister || 10} u.
                          </td>
                          <td>
                            <div className="admin-stock-indicator-wrap">
                              <div className="admin-stock-info-row">
                                <span className={`admin-badge-stock ${isCritical ? "badge-stock-danger" : isWarning ? "badge-stock-warning" : "badge-stock-success"}`}>
                                  <span className={`stock-pulse-dot ${isCritical ? "pulse-red" : isWarning ? "pulse-amber" : "pulse-green"}`} />
                                  {stockTxt}
                                </span>
                              </div>
                              <div className="admin-stock-progress-bar-bg">
                                <div
                                  className={`admin-stock-progress-bar-fill ${isCritical ? "fill-danger" : isWarning ? "fill-warning" : "fill-success"}`}
                                  style={{ width: `${stockPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="text-right font-medium">
                            {sIdActiva === null
                              ? (p.inventarios.length > 0 ? formatMoney(p.inventarios[0].precioCaja) : "S/ 0.00")
                              : (inv ? formatMoney(inv.precioCaja) : "S/ 0.00")
                            }
                          </td>
                          <td className="text-right font-medium">
                            {sIdActiva === null
                              ? (p.inventarios.length > 0 ? formatMoney(p.inventarios[0].precioUnidad) : "S/ 0.00")
                              : (inv ? formatMoney(inv.precioUnidad) : "S/ 0.00")
                            }
                          </td>
                          <td className="text-center">
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                              <button
                                className="admin-edit-inv-btn"
                                onClick={() => handleOpenEditProductModal(p)}
                                title="Editar detalles del medicamento"
                              >
                                <Edit2 size={12} strokeWidth={2.5} />
                                <span>Editar</span>
                              </button>
                              <button
                                className="admin-edit-inv-btn"
                                onClick={() => handleOpenInventoryModal(p)}
                                title="Configurar existencias y precios por sucursal"
                                style={{ background: "rgba(15,23,42,0.02)" }}
                              >
                                <Store size={12} strokeWidth={2.5} />
                                <span>Precios</span>
                              </button>
                            </div>
                          </td>
                          <td className="text-center">
                            <button
                              className="admin-delete-prod-btn"
                              onClick={() => handleDeleteProduct(p.id)}
                              title="Eliminar del catálogo global"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PANELS LATERALES DESLIZABLES (SLIDE-OVER DRAWERS) */}

        {/* DRAWER 1: Registrar Producto en Catálogo Global */}
        {showAddProductModal && (
          <div className="admin-drawer-overlay" onClick={() => setShowAddProductModal(false)}>
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="admin-modal-close-btn"
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <h3 className="admin-modal-title">Nuevo Medicamento</h3>
              <p className="admin-modal-subtitle">CATÁLOGO GLOBAL CENTRALIZADO</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Producto:</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Ibuprofeno 400mg Albis"
                    value={nombreProducto}
                    onChange={(e) => setNombreProducto(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría terapéutica:</label>
                  <select
                    className="input-field"
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                  >
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id.toString()}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Laboratorio:</label>
                  <select
                    className="input-field"
                    value={laboratorioId}
                    onChange={(e) => setLaboratorioId(e.target.value)}
                  >
                    {laboratorios.map(lab => (
                      <option key={lab.id} value={lab.id.toString()}>
                        {lab.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unidades de empaque por Caja:</label>
                  <input
                    type="number"
                    className="input-field"
                    value={cantPresentacion}
                    onChange={(e) => setCantPresentacion(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unidades de empaque por Blíster:</label>
                  <input
                    type="number"
                    className="input-field"
                    value={cantPresentacionBlister}
                    onChange={(e) => setCantPresentacionBlister(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "20px" }}>
                <button className="btn btn-outline" onClick={() => setShowAddProductModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleAddProduct} style={{ flex: 1 }}>
                  Registrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DRAWER 1.5: Editar Producto (Global) */}
        {showEditProductModal && (
          <div className="admin-drawer-overlay" onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }}>
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }}
                className="admin-modal-close-btn"
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <h3 className="admin-modal-title">Editar Medicamento</h3>
              <p className="admin-modal-subtitle">MODIFICAR DETALLES GLOBALES</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "10px" }}>
                <div className="form-group">
                  <label className="form-label">Nombre del Producto:</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editNombreProducto}
                    onChange={(e) => setEditNombreProducto(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría terapéutica:</label>
                  <select
                    className="input-field"
                    value={editCategoriaId}
                    onChange={(e) => setEditCategoriaId(e.target.value)}
                  >
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id.toString()}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Laboratorio:</label>
                  <select
                    className="input-field"
                    value={editLaboratorioId}
                    onChange={(e) => setEditLaboratorioId(e.target.value)}
                  >
                    {laboratorios.map(lab => (
                      <option key={lab.id} value={lab.id.toString()}>
                        {lab.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unidades de empaque por Caja:</label>
                  <input
                    type="number"
                    className="input-field"
                    value={editCantPresentacion}
                    onChange={(e) => setEditCantPresentacion(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unidades de empaque por Blíster:</label>
                  <input
                    type="number"
                    className="input-field"
                    value={editCantPresentacionBlister}
                    onChange={(e) => setEditCantPresentacionBlister(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "20px" }}>
                <button className="btn btn-outline" onClick={() => { setShowEditProductModal(false); setEditingProduct(null); }} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveEditProduct} style={{ flex: 1 }}>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DRAWER 2: Editar Precios, Costos y Stock por Sucursal */}
        {selectedProductForInventory && (
          <div className="admin-drawer-overlay" onClick={() => setSelectedProductForInventory(null)}>
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()} style={{ width: "520px" }}>
              <button
                onClick={() => setSelectedProductForInventory(null)}
                className="admin-modal-close-btn"
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <h3 className="admin-modal-title">Configurar Inventario</h3>
              <p className="admin-modal-subtitle" style={{ textTransform: "uppercase" }}>
                {selectedProductForInventory.nombreProducto}
              </p>
              <div style={{ padding: "8px 12px", background: "rgba(15,23,42,0.03)", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: isModoGlobal ? "12px" : "24px" }}>
                <Store size={12} strokeWidth={2.5} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
                Sucursal: {isModoGlobal
                  ? "Todas las sucursales"
                  : (sucursales.find(s => s.id === sIdActiva)?.nombre || "Principal")
                }
              </div>

              {/* Banner de advertencia modo global */}
              {isModoGlobal && (
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "rgba(234,179,8,0.09)",
                  border: "1.5px solid rgba(234,179,8,0.35)",
                  borderRadius: "10px",
                  marginBottom: "24px",
                }}>
                  <AlertTriangle size={16} strokeWidth={2.2} style={{ color: "#d97706", flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <p style={{ fontSize: "0.78rem", fontWeight: 800, color: "#92400e", margin: 0, lineHeight: 1.4 }}>
                      Modo Global — Todas las Sucursales
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#b45309", margin: "4px 0 0", lineHeight: 1.5 }}>
                      Los precios y costos ingresados se aplicarán a <strong>todas las sucursales</strong> simultáneamente. El stock físico no se modifica en este modo.
                    </p>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
                {/* Bloque Stock — ocultar existencias en modo global */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <h4 style={{ fontSize: "0.85rem", borderBottom: "1.5px solid rgba(15,23,42,0.08)", paddingBottom: "6px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>Inventario de Almacén</h4>

                  {!isModoGlobal && (
                    <div className="form-group">
                      <label className="form-label">Existencias Totales (Unidades):</label>
                      <input
                        type="number"
                        className="input-field"
                        value={cantidadTotal}
                        onChange={(e) => setCantidadTotal(e.target.value)}
                      />
                      <div className="admin-modal-info-box">
                        <span>Conversión física:</span>
                        <strong>
                          {Math.floor(parseInt(cantidadTotal || "0") / (selectedProductForInventory.cantidadPresentacion || 100))} cj + {parseInt(cantidadTotal || "0") % (selectedProductForInventory.cantidadPresentacion || 100)} und
                        </strong>
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Stock Mínimo (Alerta de reposición):</label>
                    <input
                      type="number"
                      className="input-field"
                      value={stockMinimo}
                      onChange={(e) => setStockMinimo(e.target.value)}
                    />
                  </div>
                </div>

                {/* Bloque Precios */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <h4 style={{ fontSize: "0.85rem", borderBottom: "1.5px solid rgba(15,23,42,0.08)", paddingBottom: "6px", fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>Estructura de Precios (S/)</h4>

                  <div style={{ display: "flex", gap: "16px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Precio Venta Caja:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={precioCaja}
                        onChange={(e) => setPrecioCaja(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Precio Venta Unidad:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={precioUnidad}
                        onChange={(e) => setPrecioUnidad(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "16px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Costo Adquisición Caja:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={costoCaja}
                        onChange={(e) => setCostoCaja(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Costo Adquisición Unidad:</label>
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

              <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "20px" }}>
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

        {/* DRAWER 3: Importación CSV */}
        {showImportModal && (
          <div className="admin-drawer-overlay" onClick={() => setShowImportModal(false)}>
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <button
                onClick={() => setShowImportModal(false)}
                className="admin-modal-close-btn"
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <Upload size={48} style={{ color: "#e11d48", margin: "40px 0 16px" }} />
              <h3 className="admin-modal-title" style={{ textAlign: "center" }}>Importar Catálogo</h3>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "32px", textAlign: "center", lineHeight: "1.5" }}>
                Cargue un archivo CSV estructurado para actualizar medicamentos y stocks de forma masiva en el sistema.
              </p>

              <div className="form-group" style={{ width: "100%", marginBottom: "32px" }}>
                <label className="form-label">Archivo de inventario (.CSV):</label>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  className="input-field"
                  style={{ padding: "10px" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "auto", width: "100%" }}>
                <button className="btn btn-outline" onClick={() => setShowImportModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleImportCSV} style={{ flex: 1 }}>
                  Cargar Catálogo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ ESTILOS DE REDISEÑO PREMIUM E INDUSTRIAL (VERCEL/LINEAR TYPE) ══ */}
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

        .admin-header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        /* Stats Dashboard with Radial Projects */
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
          padding: 11px 80px 11px 40px;
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

        .admin-search-shortcut-badge {
          position: absolute;
          right: 14px;
          background: #ffffff;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          border-radius: 5px;
          padding: 2px 6px;
          font-size: 0.65rem;
          font-weight: 800;
          color: #94a3b8;
          pointer-events: none;
          user-select: none;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
          text-transform: uppercase;
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

        .admin-filter-selectors {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        /* Segmented category tabs */
        .admin-tabs-container {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          gap: 2px;
          border: 1px solid rgba(15, 23, 42, 0.04);
        }

        .admin-tab-btn {
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }

        .admin-tab-btn:hover {
          color: #0f172a;
        }

        .admin-tab-btn.active {
          background: #ffffff;
          color: #e11d48;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .admin-selector-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .admin-selector-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: #64748b;
        }

        .admin-select-field {
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 7px 12px;
          border-radius: 8px;
          border: 1.5px solid rgba(15, 23, 42, 0.08);
          background: #ffffff;
          color: #0f172a;
          outline: none;
          cursor: pointer;
          min-width: 170px;
          transition: border-color 0.15s ease;
        }

        .admin-select-field:focus {
          border-color: #e11d48;
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
          transition: background 0.15s ease, transform 0.15s ease;
        }

        .admin-table tbody tr {
          transition: background 0.15s ease;
        }

        .admin-table tbody tr:hover td {
          background: rgba(15, 23, 42, 0.01);
          /* Subtle linear slide */
          transform: translateX(3px);
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

        /* SaaS Double-line cell */
        .admin-prod-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .admin-prod-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
        }

        .admin-prod-meta {
          font-size: 0.72rem;
          font-weight: 500;
          color: #94a3b8;
          letter-spacing: 0.01em;
        }

        /* Badges */
        .admin-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .badge-category {
          background: rgba(14, 165, 233, 0.08);
          color: #0369a1;
        }

        .badge-lab {
          background: rgba(100, 116, 139, 0.08);
          color: #475569;
        }

        /* Stock progress layout */
        .admin-stock-indicator-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 140px;
          margin: 0 auto;
        }

        .admin-stock-info-row {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .admin-badge-stock {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.74rem;
          font-weight: 800;
        }

        .badge-stock-success {
          background: rgba(16, 185, 129, 0.08);
          color: #047857;
        }

        .badge-stock-warning {
          background: rgba(245, 158, 11, 0.08);
          color: #d97706;
        }

        .badge-stock-danger {
          background: rgba(239, 68, 68, 0.08);
          color: #b91c1c;
        }

        .admin-stock-progress-bar-bg {
          width: 100%;
          height: 4px;
          border-radius: 99px;
          background: #f1f5f9;
          overflow: hidden;
        }

        .admin-stock-progress-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fill-success { background: #10b981; }
        .fill-warning { background: #f59e0b; }
        .fill-danger { background: #ef4444; }

        .stock-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .pulse-green {
          background: #10b981;
        }

        .pulse-amber {
          background: #f59e0b;
          animation: pulse-animation-amber 1.8s infinite;
        }

        .pulse-red {
          background: #ef4444;
          animation: pulse-animation-red 1.8s infinite;
        }

        @keyframes pulse-animation-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        @keyframes pulse-animation-amber {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        /* Table Helpers */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700 !important; }
        .font-medium { font-weight: 700 !important; }
        .text-muted { color: #64748b; }

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

        .admin-delete-prod-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
        }

        .admin-delete-prod-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        /* Slide-over Drawers (Paneles Laterales) */
        .admin-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.2);
          backdrop-filter: blur(8px);
          z-index: 100;
          display: flex;
          justify-content: flex-end; /* Align to the right edge */
          animation: admin-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-drawer-card {
          background: #ffffff;
          border-left: 1.5px solid rgba(15, 23, 42, 0.08);
          width: 490px;
          height: 100%;
          padding: 36px 28px;
          box-shadow: -10px 0 45px rgba(15, 23, 42, 0.07);
          position: relative;
          display: flex;
          flex-direction: column;
          animation: admin-slide-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          overflow-y: auto;
        }

        @keyframes admin-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes admin-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
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

        .admin-modal-subtitle {
          font-size: 0.75rem;
          font-weight: 800;
          color: #e11d48;
          margin-bottom: 24px;
          letter-spacing: 0.05em;
        }

        .admin-modal-info-box {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
        }

        .admin-modal-info-box span {
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .admin-modal-info-box strong {
          font-size: 0.88rem;
          font-weight: 800;
          color: #10b981;
        }
      `}</style>
    </>
  );
}