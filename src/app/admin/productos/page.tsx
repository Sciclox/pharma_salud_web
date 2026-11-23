"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Search, Plus, Edit2, Trash2, Store, X, FileText, CheckCircle2, Package, AlertTriangle, TrendingUp, Layers, FlaskConical, Barcode, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import CustomSelect from "@/components/CustomSelect";
import CustomMultiSelect from "@/components/CustomMultiSelect";
import SucursalSelector from "@/components/SucursalSelector";

interface Product {
  id: number;
  nombreProducto: string;
  nombreComercial: string | null;
  nombreGenerico: string | null;
  concentracion: string | null;
  formaFarmaceuticaId: number | null;
  formaFarmaceuticaRel?: { id: number; nombre: string } | null;
  presentacion: string | null;
  sku: string | null;
  codigoBarras: string | null;
  laboratorioId: number | null;
  laboratorio?: { id: number; nombre: string } | null;
  categorias?: { id: number; nombre: string }[];
  compuestos?: { id: number; nombre: string }[];
  cantidadPresentacion: number | null;
  cantidadPresentacionBlister: number | null;
  contenidoNetoValor: number | null;
  contenidoNetoUnidad: string | null;
  esGenerico: boolean;
  fechaCreacion: string;
  inventarios: {
    id: number;
    productoId: number;
    sucursalId: number;
    cantidadTotal: number;
    precioCaja: number;
    precioUnidad: number;
    precioBlister: number;
    costo: number;
    stockMinimo: number;
  }[];
}

interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
}

const UNIT_OPTIONS = ["mg", "ml", "g", "mcg", "UI", "%", "mg/ml", "g/ml"];

function parseConcentracion(concentracion: string | null) {
  if (!concentracion) return { valor: "", unidad: "mg" };
  const clean = concentracion.trim();
  const match = clean.match(/^([\d.,]+)\s*([a-zA-Z%]+(?:\s*[/]\s*[\d.,]*\s*[a-zA-Z%]+)*)$/);
  if (match) {
    return { valor: match[1], unidad: match[2] };
  }
  return { valor: clean, unidad: "mg" };
}

const renderPill = (text: string, colorVariant: "slate" | "green" | "blue" | "warning" = "slate") => {
  let bg = "#f1f5f9"; // Slate 100
  let color = "#475569"; // Slate 600
  let borderColor = "rgba(15,23,42,0.06)";

  if (colorVariant === "green") {
    bg = "#f0fdf4"; // Green 50
    color = "#15803d"; // Green 700
    borderColor = "rgba(21,128,61,0.08)";
  } else if (colorVariant === "blue") {
    bg = "#eff6ff"; // Blue 50
    color = "#1d4ed8"; // Blue 700
    borderColor = "rgba(29,78,216,0.08)";
  } else if (colorVariant === "warning") {
    bg = "#fffbeb"; // Amber 50
    color = "#b45309"; // Amber 700
    borderColor = "rgba(180,83,9,0.08)";
  }

  return (
    <span style={{
      fontSize: "0.7rem",
      fontWeight: 600,
      padding: "2px 8px",
      background: bg,
      color: color,
      borderRadius: "6px",
      border: `1px solid ${borderColor}`,
      display: "inline-flex",
      alignItems: "center"
    }}>
      {text}
    </span>
  );
};

export default function AdminProductos() {
  const searchParams = useSearchParams();
  // Productos y Sucursales
  const [productos, setProductos] = useState<Product[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const sucursalSeleccionada = searchParams.get("sucursalId") || "todos";
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [laboratorios, setLaboratorios] = useState<{ id: number; nombre: string }[]>([]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todos");
  const [laboratorioSeleccionado, setLaboratorioSeleccionado] = useState<string>("todos");
  const [loading, setLoading] = useState<boolean>(true);
  const [laboratorioLoading, setLaboratorioLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modales - CRUD Producto Global (Nuevo)
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [addProductModalTab, setAddProductModalTab] = useState<"general" | "formulacion" | "empaque">("general");
  useEscapeToClose(showAddProductModal, useCallback(() => setShowAddProductModal(false), []));
  const [tipoPlantilla, setTipoPlantilla] = useState<"medicamento" | "bazar">("medicamento");
  const [nombreComercial, setNombreComercial] = useState<string>("");
  const [nombreGenerico, setNombreGenerico] = useState<string>("");
  const [concentracion, setConcentracion] = useState<string>("");
  const [presentacion, setPresentacion] = useState<string>("Caja");
  const [sku, setSku] = useState<string>("");
  const [codigoBarras, setCodigoBarras] = useState<string>("");
  const [laboratorioId, setLaboratorioId] = useState<string>("");
  const [cantPresentacion, setCantPresentacion] = useState<string>("100");
  const [cantPresentacionBlister, setCantPresentacionBlister] = useState<string>("10");
  const [cantidadInicial, setCantidadInicial] = useState<string>("0");
  const [stockCajas, setStockCajas] = useState<string>("0");
  const [stockUnidadesSueltas, setStockUnidadesSueltas] = useState<string>("0");
  const [contenidoNetoValor, setContenidoNetoValor] = useState<string>("");
  const [contenidoNetoUnidad, setContenidoNetoUnidad] = useState<string>("ml");
  const [esGenerico, setEsGenerico] = useState<boolean>(false);

  // Nuevas relaciones dinámicas
  const [formasFarmaceuticas, setFormasFarmaceuticas] = useState<{ id: number; nombre: string }[]>([]);
  const [formaFarmaceuticaId, setFormaFarmaceuticaId] = useState<string>("");
  const [compuestos, setCompuestos] = useState<{ compuestoId: string; valor: string; unidad: string }[]>([{ compuestoId: "", valor: "", unidad: "mg" }]);
  const [categoriasIds, setCategoriasIds] = useState<string[]>([]);
  const [compuestosList, setCompuestosList] = useState<{ id: number; nombre: string }[]>([]);
  const [unidadesMedidaList, setUnidadesMedidaList] = useState<{ id: number; nombre: string }[]>([]);

  // Edición
  const [editFormaFarmaceuticaId, setEditFormaFarmaceuticaId] = useState<string>("");
  const [editCompuestos, setEditCompuestos] = useState<{ compuestoId: string; valor: string; unidad: string }[]>([{ compuestoId: "", valor: "", unidad: "mg" }]);
  const [editCategoriasIds, setEditCategoriasIds] = useState<string[]>([]);

  // Modales de creación express con modal reactivo
  const [showQuickModal, setShowQuickModal] = useState<boolean>(false);
  useEscapeToClose(showQuickModal, useCallback(() => setShowQuickModal(false), []));
  const [quickModalType, setQuickModalType] = useState<"laboratorio" | "categoria" | "formaFarmaceutica" | "compuesto" | "unidadMedida">("laboratorio");
  const [quickModalValue, setQuickModalValue] = useState<string>("");
  const [quickModalRowIndex, setQuickModalRowIndex] = useState<number>(-1);
  const [quickModalSource, setQuickModalSource] = useState<"add" | "edit">("add");
  const [quickModalError, setQuickModalError] = useState<string>("");
  const [quickModalLoading, setQuickModalLoading] = useState<boolean>(false);

  // Modales - CRUD Producto Global (Editar)
  const [editTipoPlantilla, setEditTipoPlantilla] = useState<"medicamento" | "bazar">("medicamento");
  const [editNombreComercial, setEditNombreComercial] = useState<string>("");
  const [editNombreGenerico, setEditNombreGenerico] = useState<string>("");
  const [editConcentracion, setEditConcentracion] = useState<string>("");
  const [editPresentacion, setEditPresentacion] = useState<string>("Caja");
  const [editSku, setEditSku] = useState<string>("");
  const [editCodigoBarras, setEditCodigoBarras] = useState<string>("");
  const [editLaboratorioId, setEditLaboratorioId] = useState<string>("");
  const [editCantPresentacion, setEditCantPresentacion] = useState<string>("100");
  const [editCantPresentacionBlister, setEditCantPresentacionBlister] = useState<string>("10");
  const [editContenidoNetoValor, setEditContenidoNetoValor] = useState<string>("");
  const [editContenidoNetoUnidad, setEditContenidoNetoUnidad] = useState<string>("ml");
  const [editEsGenerico, setEditEsGenerico] = useState<boolean>(false);

  // Modales - Editar Precios/Stock por Sucursal
  const [precioCaja, setPrecioCaja] = useState<string>("0.00");
  const [precioUnidad, setPrecioUnidad] = useState<string>("0.00");
  const [precioBlister, setPrecioBlister] = useState<string>("0.00");
  const [costo, setCosto] = useState<string>("0.00");

  // Modal combinado: Editar + Precios con sidebar
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  useEscapeToClose(showProductModal, useCallback(() => { setShowProductModal(false); setSelectedProduct(null); }, []));
  const [productModalTab, setProductModalTab] = useState<"editar" | "precios">("editar");
  const [editProductModalTab, setEditProductModalTab] = useState<"general" | "formulacion" | "empaque">("general");

  // Bloquear scroll del fondo cuando hay modales abiertos
  useBodyScrollLock(showAddProductModal || showProductModal || showQuickModal);



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

  const fetchFormasFarmaceuticas = useCallback(async () => {
    try {
      const res = await fetch("/api/formas-farmaceuticas");
      if (res.ok) {
        const data = await res.json();
        setFormasFarmaceuticas(data);
      }
    } catch (error) {
      console.error("Error al cargar formas farmacéuticas:", error);
    }
  }, []);

  const fetchCompuestos = useCallback(async () => {
    try {
      const res = await fetch("/api/compuestos");
      if (res.ok) {
        const data = await res.json();
        setCompuestosList(data);
      }
    } catch (error) {
      console.error("Error al cargar compuestos:", error);
    }
  }, []);

  const fetchUnidadesMedida = useCallback(async () => {
    try {
      const res = await fetch("/api/unidades-medida");
      if (res.ok) {
        const data = await res.json();
        setUnidadesMedidaList(data);
      }
    } catch (error) {
      console.error("Error al cargar unidades de medida:", error);
    }
  }, []);

  const handleOpenQuickModal = (
    type: "laboratorio" | "categoria" | "formaFarmaceutica" | "compuesto" | "unidadMedida",
    rowIndex: number = -1,
    source: "add" | "edit" = "add"
  ) => {
    setQuickModalType(type);
    setQuickModalRowIndex(rowIndex);
    setQuickModalSource(source);
    setQuickModalValue("");
    setQuickModalError("");
    setQuickModalLoading(false);
    setShowQuickModal(true);
  };

  const handleSaveQuickModal = async () => {
    if (!quickModalValue || !quickModalValue.trim()) {
      setQuickModalError("El nombre es requerido");
      return;
    }
    const valTrimmed = quickModalValue.trim();
    setQuickModalLoading(true);
    setQuickModalError("");

    let url = "";
    if (quickModalType === "laboratorio") url = "/api/laboratorios";
    else if (quickModalType === "categoria") url = "/api/categorias";
    else if (quickModalType === "formaFarmaceutica") url = "/api/formas-farmaceuticas";
    else if (quickModalType === "compuesto") url = "/api/compuestos";
    else if (quickModalType === "unidadMedida") url = "/api/unidades-medida";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: valTrimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (quickModalType === "laboratorio") {
          await fetchLaboratorios();
          if (quickModalSource === "add") {
            setLaboratorioId(data.id.toString());
          } else {
            setEditLaboratorioId(data.id.toString());
          }
        } else if (quickModalType === "categoria") {
          await fetchCategorias();
          if (quickModalSource === "add") {
            setCategoriasIds(prev => [...prev, data.id.toString()]);
          } else {
            setEditCategoriasIds(prev => [...prev, data.id.toString()]);
          }
        } else if (quickModalType === "formaFarmaceutica") {
          await fetchFormasFarmaceuticas();
          if (quickModalSource === "add") {
            setFormaFarmaceuticaId(data.id.toString());
          } else {
            setEditFormaFarmaceuticaId(data.id.toString());
          }
        } else if (quickModalType === "compuesto") {
          await fetchCompuestos();
          if (quickModalSource === "add") {
            const newComps = [...compuestos];
            if (quickModalRowIndex >= 0 && quickModalRowIndex < newComps.length) {
              newComps[quickModalRowIndex] = {
                ...newComps[quickModalRowIndex],
                compuestoId: data.id.toString(),
              };
              setCompuestos(newComps);
            }
          } else {
            const newComps = [...editCompuestos];
            if (quickModalRowIndex >= 0 && quickModalRowIndex < newComps.length) {
              newComps[quickModalRowIndex] = {
                ...newComps[quickModalRowIndex],
                compuestoId: data.id.toString(),
              };
              setEditCompuestos(newComps);
            }
          }
        } else if (quickModalType === "unidadMedida") {
          await fetchUnidadesMedida();
          if (quickModalSource === "add") {
            const newComps = [...compuestos];
            if (quickModalRowIndex >= 0 && quickModalRowIndex < newComps.length) {
              newComps[quickModalRowIndex] = {
                ...newComps[quickModalRowIndex],
                unidad: data.nombre,
              };
              setCompuestos(newComps);
            }
          } else {
            const newComps = [...editCompuestos];
            if (quickModalRowIndex >= 0 && quickModalRowIndex < newComps.length) {
              newComps[quickModalRowIndex] = {
                ...newComps[quickModalRowIndex],
                unidad: data.nombre,
              };
              setEditCompuestos(newComps);
            }
          }
        }
        setShowQuickModal(false);
      } else {
        const err = await res.json();
        setQuickModalError(err.error || "Error al guardar el dato");
      }
    } catch (e) {
      console.error(e);
      setQuickModalError("Error de red o del servidor");
    } finally {
      setQuickModalLoading(false);
    }
  };

  useEffect(() => {
    fetchSucursales();
    fetchProductos();
    fetchCategorias();
    fetchLaboratorios();
    fetchFormasFarmaceuticas();
    fetchCompuestos();
    fetchUnidadesMedida();
  }, [fetchSucursales, fetchProductos, fetchCategorias, fetchLaboratorios, fetchFormasFarmaceuticas, fetchCompuestos, fetchUnidadesMedida]);

  // Atajo de teclado F1 para enfocar el buscador
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

  // Resetear a la página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoriaSeleccionada, laboratorioSeleccionado, sucursalSeleccionada]);

  // 1. Registrar Producto en Catálogo Global
  const handleAddProduct = async () => {
    if (tipoPlantilla === "bazar" && !nombreComercial.trim()) {
      alert("El nombre del artículo es requerido");
      return;
    }
    const filteredCompuestos = compuestos
      .filter(c => c.compuestoId && c.compuestoId !== "")
      .map(c => ({
        compuestoId: c.compuestoId,
        concentracion: c.valor.trim() ? `${c.valor.trim()} ${c.unidad}`.trim() : ""
      }));
    if (tipoPlantilla === "medicamento" && !nombreComercial.trim() && filteredCompuestos.length === 0) {
      alert("El nombre comercial o al menos un compuesto genérico del producto es requerido");
      return;
    }

    // Pre-calcular nombres y campos en el cliente para evitar consultas secuenciales en la DB del backend
    const loadedCompuestosNames = filteredCompuestos.map(item => {
      const comp = compuestosList.find(c => c.id === parseInt(item.compuestoId));
      return comp ? comp.nombre : "";
    }).filter(n => n !== "");
    
    const generatedNombreGenerico = loadedCompuestosNames.join(" + ");
    const generatedConcentracion = filteredCompuestos
      .map(item => item.concentracion)
      .filter(c => c !== "")
      .join(" + ");

    const lab = laboratorios.find(l => l.id === (laboratorioId ? parseInt(laboratorioId) : 0));
    const labNombre = lab ? lab.nombre : "";

    setIsSaving(true);
    try {
      const res = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreComercial: nombreComercial || null,
          nombreGenerico: tipoPlantilla === "medicamento" ? (generatedNombreGenerico || null) : null,
          compuestos: tipoPlantilla === "medicamento" ? filteredCompuestos : [],
          concentracion: tipoPlantilla === "medicamento" ? (generatedConcentracion || null) : null,
          formaFarmaceuticaId: tipoPlantilla === "medicamento" ? (formaFarmaceuticaId ? parseInt(formaFarmaceuticaId) : null) : null,
          presentacion: presentacion || "Unidad",
          sku: sku || null,
          codigoBarras: codigoBarras || null,
          categoriasIds: categoriasIds,
          laboratorioId: laboratorioId ? parseInt(laboratorioId) : null,
          laboratorioNombre: labNombre,
          cantidadPresentacion: presentacion === "Unidad" ? 1 : (parseInt(cantPresentacion) || null),
          cantidadPresentacionBlister: (tipoPlantilla === "medicamento" && presentacion === "Caja") ? (parseInt(cantPresentacionBlister) || null) : 1,
          cantidadInicial: isModoGlobal ? 0 : (presentacion === "Caja" ? ((parseInt(stockCajas || "0") * (parseInt(cantPresentacion) || 1)) + parseInt(stockUnidadesSueltas || "0")) : (parseInt(cantidadInicial) || 0)),
          contenidoNetoValor: (tipoPlantilla === "medicamento" && presentacion === "Unitario" && contenidoNetoValor) ? contenidoNetoValor : null,
          contenidoNetoUnidad: (tipoPlantilla === "medicamento" && presentacion === "Unitario" && contenidoNetoValor) ? contenidoNetoUnidad : null,
          esGenerico: tipoPlantilla === "medicamento" ? esGenerico : false,
          precioCaja: presentacion === "Caja" ? parseFloat(precioCaja) || 0 : 0,
          precioUnidad: parseFloat(precioUnidad) || 0,
          precioBlister: presentacion === "Caja" ? parseFloat(precioBlister) || 0 : 0,
          costo: parseFloat(costo) || 0,
          sucursalId: sucursalSeleccionada,
          sucursalesIds: sucursales.map(s => s.id),
        }),
      });

      if (res.ok) {
        setShowAddProductModal(false);
        setNombreComercial("");
        setCompuestos([{ compuestoId: "", valor: "", unidad: "mg" }]);
        setConcentracion("");
        setFormaFarmaceuticaId("");
        setPresentacion("Caja");
        setSku("");
        setCodigoBarras("");
        setCantPresentacion("100");
        setCantPresentacionBlister("10");
        setCantidadInicial("0");
        setCategoriasIds([]);
        setContenidoNetoValor("");
        setContenidoNetoUnidad("ml");
        setEsGenerico(false);
        setPrecioCaja("0.00");
        setPrecioUnidad("0.00");
        setPrecioBlister("0.00");
        setCosto("0.00");
        const nuevoProducto = await res.json();
        setProductos((prev) => [nuevoProducto, ...prev]);
      } else {
        const errData = await res.json();
        alert(`Error al registrar: ${errData.error}`);
      }
    } catch (error) {
      console.error("Error al registrar producto:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler único para abrir el modal combinado (Editar + Precios)
  const handleOpenProductModal = (product: Product) => {
    setSelectedProduct(product);

    // Pre-poblar campos de edición
    setEditNombreComercial(product.nombreComercial || "");
    
    // Compuestos
    const comps = product.compuestos && product.compuestos.length > 0
      ? product.compuestos.map((c: any) => {
          const parsed = parseConcentracion(c.concentracion);
          return {
            compuestoId: c.compuestoId.toString(),
            valor: parsed.valor,
            unidad: parsed.unidad
          };
        })
      : [{ compuestoId: "", valor: "", unidad: "mg" }];
    setEditCompuestos(comps);

    setEditConcentracion(product.concentracion || "");
    setEditFormaFarmaceuticaId(product.formaFarmaceuticaId?.toString() || "");
    setEditPresentacion(product.presentacion || "");
    setEditSku(product.sku || "");
    setEditCodigoBarras(product.codigoBarras || "");

    // CategoriasIds
    const cats = product.categorias && product.categorias.length > 0
      ? product.categorias.map((c: any) => c.id.toString())
      : [];
    setEditCategoriasIds(cats);

    setEditLaboratorioId(product.laboratorioId?.toString() || (laboratorios.length > 0 ? laboratorios[0].id.toString() : ""));
    setEditCantPresentacion(product.cantidadPresentacion?.toString() || "100");
    setEditCantPresentacionBlister(product.cantidadPresentacionBlister?.toString() || "10");
    setEditContenidoNetoValor(product.contenidoNetoValor?.toString() || "");
    setEditContenidoNetoUnidad(product.contenidoNetoUnidad || "ml");
    setEditEsGenerico(product.esGenerico || false);

    // Determinar la plantilla de edición
    if (product.nombreGenerico || product.concentracion || (product.compuestos && product.compuestos.length > 0)) {
      setEditTipoPlantilla("medicamento");
    } else {
      setEditTipoPlantilla("bazar");
    }

    // Pre-poblar campos de precios y costos
    if (isModoGlobal) {
      const ref = product.inventarios[0];
      if (ref) {
        setPrecioCaja(ref.precioCaja.toFixed(2));
        setPrecioUnidad(ref.precioUnidad.toFixed(2));
        setPrecioBlister(ref.precioBlister.toFixed(2));
        setCosto(ref.costo.toFixed(2));
      } else {
        setPrecioCaja("0.00"); setPrecioUnidad("0.00"); setPrecioBlister("0.00");
        setCosto("0.00");
      }
    } else {
      const sId = getActiveSucursalId();
      const inv = product.inventarios.find(i => i.sucursalId === sId);
      if (inv) {
        setPrecioCaja(inv.precioCaja.toFixed(2));
        setPrecioUnidad(inv.precioUnidad.toFixed(2));
        setPrecioBlister(inv.precioBlister.toFixed(2));
        setCosto(inv.costo.toFixed(2));
      } else {
        setPrecioCaja("0.00"); setPrecioUnidad("0.00"); setPrecioBlister("0.00");
        setCosto("0.00");
      }
    }

    setProductModalTab("editar");
    setShowProductModal(true);
  };

  // Guardar cambios del producto desde el modal combinado
  const handleSaveEditProduct = async () => {
    if (editTipoPlantilla === "bazar" && !editNombreComercial.trim()) {
      alert("El nombre del artículo es requerido");
      return false;
    }
    const filteredEditCompuestos = editCompuestos
      .filter(c => c.compuestoId && c.compuestoId !== "")
      .map(c => ({
        compuestoId: c.compuestoId,
        concentracion: c.valor.trim() ? `${c.valor.trim()} ${c.unidad}`.trim() : ""
      }));
    if (editTipoPlantilla === "medicamento" && !editNombreComercial.trim() && filteredEditCompuestos.length === 0) {
      alert("El nombre comercial o al menos un compuesto genérico del producto es requerido");
      return false;
    }

    // Pre-calcular nombres y campos en el cliente para evitar consultas secuenciales en la DB del backend
    const loadedCompuestosNames = filteredEditCompuestos.map(item => {
      const comp = compuestosList.find(c => c.id === parseInt(item.compuestoId));
      return comp ? comp.nombre : "";
    }).filter(n => n !== "");
    
    const generatedNombreGenerico = loadedCompuestosNames.join(" + ");
    const generatedConcentracion = filteredEditCompuestos
      .map(item => item.concentracion)
      .filter(c => c !== "")
      .join(" + ");

    const lab = laboratorios.find(l => l.id === (editLaboratorioId ? parseInt(editLaboratorioId) : 0));
    const labNombre = lab ? lab.nombre : "";

    setIsSaving(true);
    try {
      const res = await fetch(`/api/productos/${selectedProduct?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreComercial: editNombreComercial || null,
          nombreGenerico: editTipoPlantilla === "medicamento" ? (generatedNombreGenerico || null) : null,
          compuestos: editTipoPlantilla === "medicamento" ? filteredEditCompuestos : [],
          concentracion: editTipoPlantilla === "medicamento" ? (generatedConcentracion || null) : null,
          formaFarmaceuticaId: editTipoPlantilla === "medicamento" ? (editFormaFarmaceuticaId ? parseInt(editFormaFarmaceuticaId) : null) : null,
          presentacion: editPresentacion || "Unidad",
          sku: "",
          codigoBarras: editCodigoBarras || null,
          categoriasIds: editCategoriasIds,
          laboratorioId: editLaboratorioId ? parseInt(editLaboratorioId) : null,
          laboratorioNombre: labNombre,
          cantidadPresentacion: editPresentacion === "Unidad" ? 1 : (parseInt(editCantPresentacion) || null),
          cantidadPresentacionBlister: (editTipoPlantilla === "medicamento" && editPresentacion === "Caja") ? (parseInt(editCantPresentacionBlister) || null) : 1,
          contenidoNetoValor: (editTipoPlantilla === "medicamento" && editPresentacion === "Unitario" && editContenidoNetoValor) ? editContenidoNetoValor : null,
          contenidoNetoUnidad: (editTipoPlantilla === "medicamento" && editPresentacion === "Unitario" && editContenidoNetoValor) ? editContenidoNetoUnidad : null,
          esGenerico: editTipoPlantilla === "medicamento" ? editEsGenerico : false,
          precioCaja: parseFloat(precioCaja) || 0,
          precioUnidad: parseFloat(precioUnidad) || 0,
          precioBlister: parseFloat(precioBlister) || 0,
          costo: parseFloat(costo) || 0,
          sucursalId: isModoGlobal ? "todos" : getActiveSucursalId(),
        }),
      });

      if (res.ok) {
        const updatedProduct = await res.json();
        setProductos((prev) => prev.map((p) => p.id === updatedProduct.id ? updatedProduct : p));
        return true;
      } else {
        const errData = await res.json();
        alert(`Error al guardar: ${errData.error}`);
        return false;
      }
    } catch (error) {
      console.error("Error al editar producto:", error);
      return false;
    } finally {
      setIsSaving(false);
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

  // 3. Guardar Precios/Costos en la sucursal activa (o en todas si modo global)
  const handleSaveInventory = async () => {
    if (!selectedProduct) return false;

    const sucursalIdPayload = isModoGlobal ? "todos" : getActiveSucursalId();

    try {
      const body: Record<string, unknown> = {
        productoId: selectedProduct.id,
        sucursalId: sucursalIdPayload,
        precioCaja: parseFloat(precioCaja),
        precioUnidad: parseFloat(precioUnidad),
        precioBlister: parseFloat(precioBlister),
        costo: parseFloat(costo),
      };

      const res = await fetch("/api/inventarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return true;
      } else {
        alert("Error al actualizar precios e inventario");
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  // Guardar Cambios combinado (detalles del producto y precios del inventario)
  const handleSaveAllProductAndInventory = async () => {
    const success = await handleSaveEditProduct();
    if (success) {
      setShowProductModal(false);
      setSelectedProduct(null);
    }
  };

  // 4. Eliminar Producto de Catálogo Global
  const handleDeleteProduct = async (id: number) => {
    const confirmed = await (window as any).showConfirm("¿Está seguro de eliminar este producto de forma física de todas las sucursales del catálogo central? Esta acción no se puede deshacer y borrará todo su stock asociado.");
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Producto eliminado correctamente.");
        setProductos((prev) => prev.filter((p) => p.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Error al eliminar producto");
      }
    } catch (error) {
      console.error(error);
    }
  };





  // Filtrado reactivo en cliente para velocidad instantánea
  const sIdActiva = sucursalSeleccionada === "todos" ? null : parseInt(sucursalSeleccionada);

  const filteredProducts = productos.filter(p => {
    const categoryNames = (p.categorias || []).map(c => c.nombre);

    const matchesSearch = p.nombreProducto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      categoryNames.some(name => name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.laboratorio?.nombre && p.laboratorio.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoriaSeleccionada === "todos" ||
      categoryNames.some(name => name.toLowerCase() === categoriaSeleccionada.toLowerCase());

    const matchesLaboratorio = laboratorioSeleccionado === "todos" ||
      p.laboratorioId === parseInt(laboratorioSeleccionado);

    return matchesSearch && matchesCategory && matchesLaboratorio;
  });

  // Paginación del lado del cliente
  const ITEMS_PER_PAGE = 15;
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  
  const paginatedProducts = filteredProducts.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

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

            <button className="btn btn-primary" onClick={() => { setAddProductModalTab("general"); setStockCajas("0"); setStockUnidadesSueltas("0"); setShowAddProductModal(true); }}>
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
            <div className="admin-search-shortcut-badge">F1</div>
            {searchQuery && (
              <button className="admin-search-clear-btn" onClick={() => setSearchQuery("")} style={{ right: "62px" }}>
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px", padding: "0 4px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Categoría Terapéutica
              </label>
              <CustomSelect
                options={[{value:"todos", label:"Todas las categorías"}, ...categorias.map(cat => ({value: cat.nombre, label: cat.nombre}))]}
                value={categoriaSeleccionada}
                onChange={setCategoriaSeleccionada}
                width="220px"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Laboratorio
              </label>
              <CustomSelect
                options={[{value:"todos", label:"Todos los laboratorios"}, ...laboratorios.map(lab => ({value: lab.id.toString(), label: lab.nombre}))]}
                value={laboratorioSeleccionado}
                onChange={setLaboratorioSeleccionado}
                width="220px"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                Sucursal
              </label>
              <SucursalSelector />
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
                    <th style={{ width: "50%" }}>Medicamento</th>
                    <th className="text-center" style={{ width: "13%" }}>Stock</th>
                    <th className="text-right" style={{ width: "12%" }}>P. CAJA</th>
                    <th className="text-right" style={{ width: "12%" }}>P. BLISTER</th>
                    <th className="text-right" style={{ width: "13%" }}>P. UNIDAD</th>
                    <th className="text-center" style={{ width: "120px" }}>Gestión</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-table-empty">
                        <div className="admin-empty-state">
                          <Package size={40} className="admin-empty-icon" />
                          <p>No se encontraron productos en el catálogo central.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p) => {
                      const inv = sIdActiva === null ? null : p.inventarios.find(i => i.sucursalId === sIdActiva);
                      const factor = p.cantidadPresentacion || 1;
                      const totalUnidades = sIdActiva === null
                        ? p.inventarios.reduce((acc, curr) => acc + curr.cantidadTotal, 0)
                        : (inv ? inv.cantidadTotal : 0);
                      const stockCajas = Math.floor(totalUnidades / factor);
                      const stockUnidades = totalUnidades % factor;

                      const esCaja = p.presentacion === "Caja";
                      const blisterQty = p.cantidadPresentacionBlister;
                      const precioCajaActual = sIdActiva === null
                        ? (p.inventarios.length > 0 ? p.inventarios[0].precioCaja : 0)
                        : (inv ? inv.precioCaja : 0);
                      const invBlister = sIdActiva === null
                        ? (p.inventarios.length > 0 ? p.inventarios[0].precioBlister : 0)
                        : (inv ? inv.precioBlister : 0);
                      const precioBlister = esCaja && blisterQty && blisterQty > 1
                        ? (invBlister > 0 ? invBlister : (precioCajaActual / factor) * blisterQty)
                        : null;

                      const stockMinimoNum = sIdActiva === null
                        ? p.inventarios.reduce((acc, curr) => acc + curr.stockMinimo, 0)
                        : (inv ? inv.stockMinimo : 0);

                      // Criterios de alertas
                      const isCritical = totalUnidades <= stockMinimoNum;
                      const isWarning = totalUnidades > stockMinimoNum && totalUnidades <= stockMinimoNum * 1.5;

                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="admin-prod-cell" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              {/* Línea principal: Nombre + Capsulas */}
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span className="admin-prod-name" style={{ fontWeight: 400, fontSize: "0.85rem", color: "#0f172a" }}>
                                  {p.esGenerico 
                                    ? `${p.nombreComercial || p.nombreGenerico}${p.concentracion ? ' ' + p.concentracion : ''}` 
                                    : (p.nombreComercial || p.nombreGenerico)}
                                </span>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  
                                  {/* 2. Forma Farmacéutica + Cantidad Presentación / Contenido Neto */}
                                  {p.presentacion === "Caja" ? (
                                    <>
                                      {p.formaFarmaceuticaRel?.nombre && renderPill(p.formaFarmaceuticaRel.nombre)}
                                      {renderPill(`Caja x ${p.cantidadPresentacion || 100}`)}
                                    </>
                                  ) : (
                                    p.contenidoNetoValor && p.contenidoNetoUnidad ? (
                                      renderPill(p.formaFarmaceuticaRel?.nombre 
                                        ? `${p.formaFarmaceuticaRel.nombre} ${p.contenidoNetoValor}${p.contenidoNetoUnidad}`
                                        : `${p.contenidoNetoValor}${p.contenidoNetoUnidad}`
                                      )
                                    ) : (
                                      renderPill(p.formaFarmaceuticaRel?.nombre || p.presentacion || "Unidad")
                                    )
                                  )}
                                  
                                  {/* 3. Blíster (si es Caja y tiene cantidadPresentacionBlister > 1) */}
                                  {p.presentacion === "Caja" && p.cantidadPresentacionBlister && p.cantidadPresentacionBlister > 1 && (
                                    renderPill(`Blister x ${p.cantidadPresentacionBlister}`)
                                  )}
                                  
                                  {/* 4. Laboratorio */}
                                  {p.laboratorio?.nombre && (
                                    renderPill(p.laboratorio.nombre)
                                  )}
                                </div>
                              </div>
                              

                              
                              {/* Línea de metadatos (SKU) */}
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.7rem", color: "#94a3b8", marginTop: "1px" }}>
                                <span style={{ fontFamily: "monospace", letterSpacing: "0.03em" }}>SKU: {p.sku || "N/A"}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="admin-stock-indicator-wrap">
                              <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                                {esCaja ? (
                                  <>
                                    {stockCajas > 0 && (
                                      <span className={`admin-badge-stock ${isCritical ? "badge-stock-danger" : isWarning ? "badge-stock-warning" : "badge-stock-success"}`}>
                                        {stockCajas} CAJA{stockCajas !== 1 ? "S" : ""}
                                      </span>
                                    )}
                                    {(stockCajas === 0 || stockUnidades > 0) && (
                                    <span style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 400,
                                      background: "#f1f5f9",
                                      padding: "2px 8px",
                                      borderRadius: "6px",
                                      color: "#475569",
                                      border: "1px solid rgba(15,23,42,0.06)",
                                    }}>
                                      {stockUnidades} UND
                                    </span>
                                    )}
                                  </>
                                ) : (
                                  <span className={`admin-badge-stock ${isCritical ? "badge-stock-danger" : isWarning ? "badge-stock-warning" : "badge-stock-success"}`}>
                                    {totalUnidades} UND
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-right">
                            {!esCaja ? "--" : (
                              sIdActiva === null
                                ? (p.inventarios.length > 0 ? formatMoney(p.inventarios[0].precioCaja) : "S/ 0.00")
                                : (inv ? formatMoney(inv.precioCaja) : "S/ 0.00")
                            )}
                          </td>
                          <td className="text-right">
                            {precioBlister !== null ? formatMoney(precioBlister) : "--"}
                          </td>
                          <td className="text-right">
                            {sIdActiva === null
                              ? (p.inventarios.length > 0 ? formatMoney(p.inventarios[0].precioUnidad) : "S/ 0.00")
                              : (inv ? formatMoney(inv.precioUnidad) : "S/ 0.00")
                            }
                          </td>
                          <td className="text-center">
                            <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                              <button
                                className="admin-edit-inv-btn"
                                onClick={() => handleOpenProductModal(p)}
                                title="Editar producto y precios"
                                style={{ padding: "6px 10px" }}
                              >
                                <Edit2 size={13} strokeWidth={2.5} />
                              </button>
                              <button
                                className="admin-edit-inv-btn"
                                onClick={() => handleDeleteProduct(p.id)}
                                title="Eliminar del catálogo global"
                                style={{ padding: "6px 10px", background: "rgba(239,68,68,0.06)", color: "#dc2626" }}
                              >
                                <Trash2 size={13} strokeWidth={2} />
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

            {/* Paginación del lado del cliente */}
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
                  Mostrando <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{((activePage - 1) * ITEMS_PER_PAGE) + 1}</span> a{" "}
                  <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{Math.min(activePage * ITEMS_PER_PAGE, totalItems)}</span> de{" "}
                  <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{totalItems}</span> productos
                </span>

                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(activePage - 1, 1))}
                    disabled={activePage === 1}
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
                      if (activePage > 3) pages.push("...");
                      
                      const start = Math.max(2, activePage - 1);
                      const end = Math.min(totalPages - 1, activePage + 1);
                      
                      for (let i = start; i <= end; i++) {
                        if (!pages.includes(i)) pages.push(i);
                      }
                      
                      if (activePage < totalPages - 2) pages.push("...");
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
                      
                      const isSelected = page === activePage;
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
                    onClick={() => setCurrentPage(Math.min(activePage + 1, totalPages))}
                    disabled={activePage === totalPages}
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

        {/* PANELS LATERALES DESLIZABLES (SLIDE-OVER DRAWERS) */}

        {/* DRAWER 1: Registrar Producto en Catálogo Global */}
        {showAddProductModal && (
          <div className="admin-modal-overlay-centered overlay-bg-blur">
            <div className="admin-modal-card-centered" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "820px", padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="admin-modal-close-btn"
                style={{ top: "20px", right: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", zIndex: 10 }}
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <div style={{ display: "flex", minHeight: "520px" }}>
                {/* BARRA LATERAL IZQUIERDA */}
                <div style={{
                  width: "180px",
                  flexShrink: 0,
                  background: "#f8fafc",
                  borderRight: "1px solid rgba(15,23,42,0.06)",
                  padding: "24px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}>
                  <div style={{ padding: "0 8px 16px", borderBottom: "1px solid rgba(15,23,42,0.06)", marginBottom: "8px" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                      {tipoPlantilla === "medicamento" ? "Medicamento" : "Bazar / General"}
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setAddProductModalTab("general")}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
                      background: addProductModalTab === "general" ? "#fff" : "transparent",
                      color: addProductModalTab === "general" ? "#0f172a" : "#64748b",
                      boxShadow: addProductModalTab === "general" ? "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" : "none",
                      textAlign: "left",
                    }}
                  >
                    General
                  </button>

                  {tipoPlantilla === "medicamento" && (
                    <button
                      type="button"
                      onClick={() => setAddProductModalTab("formulacion")}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px",
                        border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
                        background: addProductModalTab === "formulacion" ? "#fff" : "transparent",
                        color: addProductModalTab === "formulacion" ? "#0f172a" : "#64748b",
                        boxShadow: addProductModalTab === "formulacion" ? "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" : "none",
                        textAlign: "left",
                      }}
                    >
                      Formulación
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setAddProductModalTab("empaque")}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
                      background: addProductModalTab === "empaque" ? "#fff" : "transparent",
                      color: addProductModalTab === "empaque" ? "#0f172a" : "#64748b",
                      boxShadow: addProductModalTab === "empaque" ? "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" : "none",
                      textAlign: "left",
                    }}
                  >
                    Empaque y Stock
                  </button>
                </div>

                {/* CONTENIDO DERECHO */}
                <div style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                  {/* Header */}
                  <div className="admin-modal-header" style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div>
                        <h3 className="admin-modal-title" style={{ margin: 0, fontSize: "1.25rem" }}>
                          {tipoPlantilla === "medicamento" ? "Nuevo Medicamento" : "Nuevo Artículo de Bazar / General"}
                        </h3>
                        <p className="admin-modal-subtitle" style={{ margin: 0, fontSize: "0.72rem", color: "#64748b" }}>
                          CATÁLOGO GLOBAL CENTRALIZADO
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* TABS DE PLANTILLA (Solo en pestaña General para evitar estados confusos) */}
                  {addProductModalTab === "general" && (
                    <div className="admin-modal-tabs" style={{ display: "flex", gap: "6px", marginBottom: "20px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoPlantilla("medicamento");
                          setPresentacion("Caja");
                          setCantPresentacion("100");
                          setCantPresentacionBlister("10");
                        }}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          background: tipoPlantilla === "medicamento" ? "#ffffff" : "transparent",
                          color: tipoPlantilla === "medicamento" ? "#e11d48" : "#64748b",
                          boxShadow: tipoPlantilla === "medicamento" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        Medicamento
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoPlantilla("bazar");
                          setNombreGenerico("");
                          setConcentracion("");
                          setPresentacion("Unidad");
                          setCantPresentacion("1");
                          setCantPresentacionBlister("1");
                        }}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer",
                          background: tipoPlantilla === "bazar" ? "#ffffff" : "transparent",
                          color: tipoPlantilla === "bazar" ? "#e11d48" : "#64748b",
                          boxShadow: tipoPlantilla === "bazar" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        Bazar / General
                      </button>
                    </div>
                  )}

                  {/* CONTENIDO DE PESTAÑAS */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1, marginBottom: "20px" }}>
                    {addProductModalTab === "general" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "16px" }}>
                          <Layers size={14} style={{ color: "#e11d48" }} />
                          <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Identificación Principal</span>
                        </div>
                        {tipoPlantilla === "medicamento" && (
                          <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Clasificación del Medicamento:</label>
                            <div style={{ display: "flex", background: "#f1f5f9", padding: "3px", borderRadius: "8px", width: "100%", maxWidth: "320px" }}>
                              <button
                                type="button"
                                onClick={() => setEsGenerico(false)}
                                style={{
                                  flex: 1,
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: "pointer",
                                  background: !esGenerico ? "#ffffff" : "transparent",
                                  color: !esGenerico ? "#0f172a" : "#64748b",
                                  boxShadow: !esGenerico ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                                  transition: "all 0.2s"
                                }}
                              >
                                Marca
                              </button>
                              <button
                                type="button"
                                onClick={() => setEsGenerico(true)}
                                style={{
                                  flex: 1,
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: "pointer",
                                  background: esGenerico ? "#ffffff" : "transparent",
                                  color: esGenerico ? "#0f172a" : "#64748b",
                                  boxShadow: esGenerico ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                                  transition: "all 0.2s"
                                }}
                              >
                                Genérico
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="form-group" style={{ marginBottom: "16px" }}>
                          <label className="form-label">
                            {tipoPlantilla === "medicamento" ? (esGenerico ? "Nombre del Genérico:" : "Nombre Comercial:") : "Nombre del Producto:"}
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder={tipoPlantilla === "medicamento" ? (esGenerico ? "Ej. Paracetamol" : "Ej. Panadol") : "Ej. Oso de Peluche con Corazón 30cm"}
                            value={nombreComercial}
                            onChange={(e) => setNombreComercial(e.target.value)}
                          />
                        </div>
                        <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">
                              {tipoPlantilla === "medicamento" ? "Categorías terapéuticas:" : "Categoría:"}
                            </label>
                            <CustomMultiSelect
                              options={categorias.map(c => ({ value: c.id.toString(), label: c.nombre }))}
                              value={categoriasIds}
                              onChange={setCategoriasIds}
                              placeholder="Seleccione categorías"
                              onCreateNew={() => handleOpenQuickModal("categoria", -1, "add")}
                              onCreateNewLabel="+ Crear Categoría"
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">
                              {tipoPlantilla === "medicamento" ? "Laboratorio:" : "Marca / Fabricante:"}
                            </label>
                            <CustomSelect
                              options={laboratorios.map(l => ({ value: l.id.toString(), label: l.nombre }))}
                              value={laboratorioId}
                              onChange={setLaboratorioId}
                              placeholder="Seleccione marca"
                              onCreateNew={() => handleOpenQuickModal("laboratorio", -1, "add")}
                              onCreateNewLabel="+ Crear Laboratorio"
                            />
                          </div>
                        </div>
                        {tipoPlantilla === "medicamento" && (
                          <div className="form-row" style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Forma Farmacéutica:</label>
                              <CustomSelect
                                options={formasFarmaceuticas.map(f => ({ value: f.id.toString(), label: f.nombre }))}
                                value={formaFarmaceuticaId}
                                onChange={setFormaFarmaceuticaId}
                                placeholder="Seleccione forma"
                                onCreateNew={() => handleOpenQuickModal("formaFarmaceutica", -1, "add")}
                                onCreateNewLabel="+ Crear Forma Farmacéutica"
                              />
                            </div>
                            <div style={{ flex: 1 }} />
                          </div>
                        )}
                      </div>
                    )}

                    {addProductModalTab === "formulacion" && tipoPlantilla === "medicamento" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "16px" }}>
                          <FlaskConical size={14} style={{ color: "#e11d48" }} />
                          <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Formulación y Principios Activos</span>
                        </div>

                        <div className="form-group" style={{ marginBottom: "16px" }}>
                          <label className="form-label">Compuestos / Principios Activos (Dato + Dosis):</label>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {compuestos.map((comp, idx) => (
                              <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <div style={{ flex: 2 }}>
                                  <CustomSelect
                                    options={compuestosList.map(c => ({ value: c.id.toString(), label: c.nombre }))}
                                    value={comp.compuestoId}
                                    onChange={(val) => {
                                      const newComps = [...compuestos];
                                      newComps[idx] = { ...newComps[idx], compuestoId: val };
                                      setCompuestos(newComps);
                                    }}
                                    placeholder="Compuesto"
                                    onCreateNew={() => handleOpenQuickModal("compuesto", idx, "add")}
                                    onCreateNewLabel="+ Crear Compuesto"
                                  />
                                </div>
                                <div style={{ flex: 1.2, display: "flex", gap: "4px" }}>
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Dosis (Ej. 500)"
                                    value={comp.valor}
                                    onChange={(e) => {
                                      const newComps = [...compuestos];
                                      newComps[idx] = { ...newComps[idx], valor: e.target.value };
                                      setCompuestos(newComps);
                                    }}
                                    style={{ flex: 1, minWidth: "60px" }}
                                  />
                                  <CustomSelect
                                    options={unidadesMedidaList.map(u => ({ value: u.nombre, label: u.nombre }))}
                                    value={comp.unidad}
                                    onChange={(val) => {
                                      const newComps = [...compuestos];
                                      newComps[idx] = { ...newComps[idx], unidad: val };
                                      setCompuestos(newComps);
                                    }}
                                    placeholder="U."
                                    width="105px"
                                    onCreateNew={() => handleOpenQuickModal("unidadMedida", idx, "add")}
                                    onCreateNewLabel="+ Crear Unidad"
                                  />
                                </div>
                                {compuestos.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setCompuestos(compuestos.filter((_, i) => i !== idx))}
                                    style={{
                                      padding: "0 10px",
                                      height: "42px",
                                      border: "1.5px solid #fda4af",
                                      borderRadius: "10px",
                                      background: "#fff1f2",
                                      color: "#e11d48",
                                      cursor: "pointer",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      flexShrink: 0
                                    }}
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCompuestos([...compuestos, { compuestoId: "", valor: "", unidad: "mg" }])}
                            style={{
                              marginTop: "8px",
                              padding: "6px 12px",
                              border: "1.5px solid #e2e8f0",
                              borderRadius: "10px",
                              background: "#f8fafc",
                              color: "#475569",
                              cursor: "pointer",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Plus size={12} />
                            Añadir compuesto
                          </button>
                        </div>

                        <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Concentración (Auto-generado):</label>
                            <input
                              type="text"
                              className="input-field"
                              style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
                              placeholder="Se calculará de los compuestos"
                              value={compuestos.map(c => c.valor && c.valor.trim() ? `${c.valor.trim()} ${c.unidad}`.trim() : "").filter(c => c !== "").join(" + ")}
                              readOnly
                            />
                          </div>
                          <div style={{ flex: 1 }} />
                        </div>
                      </div>
                    )}

                    {addProductModalTab === "empaque" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "16px" }}>
                          <Barcode size={14} style={{ color: "#e11d48" }} />
                          <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Empaque y Logística</span>
                        </div>

                        <div className="form-row" style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Presentación:</label>
                            <CustomSelect
                              options={[{ value: "Caja", label: "Caja" }, { value: "Unitario", label: "Unitario" }]}
                              value={presentacion}
                              onChange={(val) => {
                                setPresentacion(val);
                                if (val === "Unitario") {
                                  setCantPresentacion("1");
                                  setCantPresentacionBlister("1");
                                } else {
                                  setContenidoNetoValor("");
                                  setContenidoNetoUnidad("ml");
                                }
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Código de Barras:</label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Ej. 7751234567890"
                              value={codigoBarras}
                              onChange={(e) => setCodigoBarras(e.target.value)}
                            />
                          </div>
                        </div>

                        {presentacion === "Caja" && (
                          <div className="form-row" style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Unidades por Caja:</label>
                              <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={cantPresentacion}
                                onChange={(e) => setCantPresentacion(e.target.value)}
                              />
                            </div>
                            {tipoPlantilla === "medicamento" && (
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Unidades por Blíster:</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="input-field"
                                  value={cantPresentacionBlister}
                                  onChange={(e) => setCantPresentacionBlister(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {tipoPlantilla === "medicamento" && presentacion === "Unitario" && (
                          <div className="form-row" style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Contenido Neto (Volumen/Peso del envase):</label>
                              <div style={{ display: "flex", gap: "8px" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    className="input-field"
                                    placeholder="Ej. 100"
                                    value={contenidoNetoValor}
                                    onChange={(e) => setContenidoNetoValor(e.target.value)}
                                  style={{ flex: 1 }}
                                />
                                <CustomSelect
                                  options={[
                                    { value: "ml", label: "ml" },
                                    { value: "g", label: "g" },
                                    { value: "L", label: "L" },
                                    { value: "oz", label: "oz" },
                                    { value: "mg", label: "mg" },
                                    { value: "mcg", label: "mcg" },
                                  ]}
                                  value={contenidoNetoUnidad}
                                  onChange={setContenidoNetoUnidad}
                                  width="100px"
                                />
                              </div>
                              <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                                Opcional. Para jarabes, cremas, gotas, etc.
                              </p>
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "16px", marginTop: "10px" }}>
                          <Package size={14} style={{ color: "#e11d48" }} />
                          <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Stock Inicial</span>
                        </div>

                        {presentacion === "Caja" ? (
                          <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Cantidad de Cajas:</label>
                              <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={isModoGlobal ? "0" : stockCajas}
                                onChange={(e) => setStockCajas(e.target.value)}
                                disabled={isModoGlobal}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Unidades Sueltas:</label>
                              <input
                                type="number"
                                min="0"
                                className="input-field"
                                value={isModoGlobal ? "0" : stockUnidadesSueltas}
                                onChange={(e) => setStockUnidadesSueltas(e.target.value)}
                                disabled={isModoGlobal}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="form-group">
                            <label className="form-label">Cantidad Inicial (Unidades):</label>
                            <input
                              type="number"
                              min="0"
                              className="input-field"
                              value={isModoGlobal ? "0" : cantidadInicial}
                              onChange={(e) => setCantidadInicial(e.target.value)}
                              disabled={isModoGlobal}
                            />
                          </div>
                        )}
                        {isModoGlobal ? (
                          <p style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "4px" }}>
                            ℹ️ En el modo "Todas las sucursales" no se puede establecer un stock inicial. El producto se creará con stock 0 en todas las sucursales.
                          </p>
                        ) : presentacion === "Caja" && parseInt(cantPresentacion) > 0 && (
                          <div className="admin-modal-info-box" style={{ marginTop: "8px" }}>
                            <span>Total:</span>
                            <strong>
                              {(() => {
                                const total = (parseInt(stockCajas || "0") * parseInt(cantPresentacion)) + parseInt(stockUnidadesSueltas || "0");
                                return `${total} und`;
                              })()}
                            </strong>
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "16px", marginTop: "18px" }}>
                          <TrendingUp size={14} style={{ color: "#e11d48" }} />
                          <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Precios de Venta (S/)</span>
                        </div>

                        {presentacion === "Caja" ? (
                          <>
                            <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Precio Caja:</label>
                                <input type="number" step="0.01" min="0" className="input-field" value={precioCaja} onChange={(e) => setPrecioCaja(e.target.value)} />
                              </div>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Precio Unidad:</label>
                                <input type="number" step="0.01" min="0" className="input-field" value={precioUnidad} onChange={(e) => setPrecioUnidad(e.target.value)} />
                              </div>
                            </div>
                            <div className="form-row" style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Precio Blíster:</label>
                                <input type="number" step="0.01" min="0" className="input-field" value={precioBlister} onChange={(e) => setPrecioBlister(e.target.value)} />
                              </div>
                              <div className="form-group" style={{ flex: 1 }} />
                            </div>
                          </>
                        ) : (
                          <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Precio Unidad:</label>
                              <input type="number" step="0.01" min="0" className="input-field" value={precioUnidad} onChange={(e) => setPrecioUnidad(e.target.value)} />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "16px", marginTop: "16px" }}>
                          <Package size={14} style={{ color: "#e11d48" }} />
                          <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Costos de Adquisición (S/)</span>
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="form-label">Costo (S/):</label>
                          <input type="number" step="0.01" min="0" className="input-field" value={costo} onChange={(e) => setCosto(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACCIONES Y STEPPER DE NAVEGACIÓN */}
                  <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "14px", borderTop: "1.5px solid #f1f5f9" }}>
                    {addProductModalTab === "general" && (
                      <>
                        <button type="button" className="btn btn-outline" onClick={() => setShowAddProductModal(false)} style={{ flex: 1 }}>
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            if (tipoPlantilla === "medicamento") {
                              setAddProductModalTab("formulacion");
                            } else {
                              setAddProductModalTab("empaque");
                            }
                          }}
                          style={{ flex: 1 }}
                        >
                          Siguiente
                        </button>
                      </>
                    )}

                    {addProductModalTab === "formulacion" && (
                      <>
                        <button type="button" className="btn btn-outline" onClick={() => setAddProductModalTab("general")} style={{ flex: 1 }}>
                          Atrás
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => setAddProductModalTab("empaque")} style={{ flex: 1 }}>
                          Siguiente
                        </button>
                      </>
                    )}

                    {addProductModalTab === "empaque" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            if (tipoPlantilla === "medicamento") {
                              setAddProductModalTab("formulacion");
                            } else {
                              setAddProductModalTab("general");
                            }
                          }}
                          style={{ flex: 1 }}
                        >
                          Atrás
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-primary" 
                          onClick={handleAddProduct} 
                          style={{ flex: 1, opacity: isSaving ? 0.7 : 1, cursor: isSaving ? "not-allowed" : "pointer" }}
                          disabled={isSaving}
                        >
                          {isSaving ? "Registrando..." : (tipoPlantilla === "medicamento" ? "Registrar Medicamento" : "Registrar Artículo")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL COMBINADO: Editar Producto + Precios (con barra lateral) */}
        {showProductModal && selectedProduct && (
          <div className="admin-modal-overlay-centered overlay-bg-blur">
            <div className="admin-modal-card-centered" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "820px", padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => { setShowProductModal(false); setSelectedProduct(null); }}
                className="admin-modal-close-btn"
                style={{ top: "20px", right: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", zIndex: 10 }}
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              <div style={{ display: "flex", minHeight: "520px" }}>
                {/* BARRA LATERAL IZQUIERDA */}
                <div style={{
                  width: "180px",
                  flexShrink: 0,
                  background: "#f8fafc",
                  borderRight: "1px solid rgba(15,23,42,0.06)",
                  padding: "24px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}>
                  <div style={{ padding: "0 8px 16px", borderBottom: "1px solid rgba(15,23,42,0.06)", marginBottom: "8px" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                      {selectedProduct.nombreProducto}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditProductModalTab("general")}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
                      background: editProductModalTab === "general" ? "#fff" : "transparent",
                      color: editProductModalTab === "general" ? "#0f172a" : "#64748b",
                      boxShadow: editProductModalTab === "general" ? "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    General
                  </button>
                  {editTipoPlantilla === "medicamento" && (
                    <button
                      onClick={() => setEditProductModalTab("formulacion")}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px",
                        border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
                        background: editProductModalTab === "formulacion" ? "#fff" : "transparent",
                        color: editProductModalTab === "formulacion" ? "#0f172a" : "#64748b",
                        boxShadow: editProductModalTab === "formulacion" ? "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" : "none",
                      }}
                    >
                      Formulación
                    </button>
                  )}
                  <button
                    onClick={() => setEditProductModalTab("empaque")}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 14px",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600,
                      background: editProductModalTab === "empaque" ? "#fff" : "transparent",
                      color: editProductModalTab === "empaque" ? "#0f172a" : "#64748b",
                      boxShadow: editProductModalTab === "empaque" ? "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    Empaque y Stock
                  </button>
                </div>

                {/* CONTENIDO DERECHO */}
                <div style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                  {editProductModalTab === "general" && (
                    <>
                      <div className="admin-modal-header" style={{ marginBottom: "12px" }}>
                        <div>
                          <h3 className="admin-modal-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                            {editTipoPlantilla === "medicamento" ? "Editar Medicamento" : "Editar Artículo de Bazar / General"}
                          </h3>
                          <p className="admin-modal-subtitle" style={{ margin: 0, fontSize: "0.68rem", color: "#64748b" }}>MODIFICAR DETALLES GLOBALES</p>
                        </div>
                      </div>

                      {!isModoGlobal && (
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px 14px", color: "#1e40af", fontSize: "0.75rem", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center", lineHeight: "1.4" }}>
                          <span>ℹ️ <strong>Modo Sucursal ({sucursales.find(s => s.id === getActiveSucursalId())?.nombre}):</strong> Solo se pueden modificar los precios para esta sucursal. Los detalles globales del producto son de solo lectura.</span>
                        </div>
                      )}

                      {/* TABS DE PLANTILLA DE EDICIÓN */}
                      <div className="admin-modal-tabs" style={{ display: "flex", gap: "6px", marginBottom: "16px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isModoGlobal) return;
                            setEditTipoPlantilla("medicamento");
                            if (!editPresentacion || editPresentacion === "Unidad") {
                              setEditPresentacion("Caja");
                              setEditCantPresentacion("100");
                              setEditCantPresentacionBlister("10");
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            border: "none",
                            cursor: isModoGlobal ? "pointer" : "not-allowed",
                            background: editTipoPlantilla === "medicamento" ? "#ffffff" : "transparent",
                            color: editTipoPlantilla === "medicamento" ? "#e11d48" : "#64748b",
                            boxShadow: editTipoPlantilla === "medicamento" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                            transition: "all 0.2s",
                            opacity: isModoGlobal ? 1 : 0.65,
                          }}
                        >
                          Medicamento
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isModoGlobal) return;
                            setEditTipoPlantilla("bazar");
                            setEditNombreGenerico("");
                            setEditConcentracion("");
                            setEditPresentacion("Unidad");
                            setEditCantPresentacion("1");
                            setEditCantPresentacionBlister("1");
                          }}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            border: "none",
                            cursor: isModoGlobal ? "pointer" : "not-allowed",
                            background: editTipoPlantilla === "bazar" ? "#ffffff" : "transparent",
                            color: editTipoPlantilla === "bazar" ? "#e11d48" : "#64748b",
                            boxShadow: editTipoPlantilla === "bazar" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                            transition: "all 0.2s",
                            opacity: isModoGlobal ? 1 : 0.65,
                          }}
                        >
                          Bazar / General
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1 }}>
                        {/* SECCIÓN IDENTIFICACIÓN PRINCIPAL */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "12px" }}>
                            <Layers size={14} style={{ color: "#e11d48" }} />
                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Identificación Principal</span>
                          </div>
                          {editTipoPlantilla === "medicamento" && (
                            <div className="form-group" style={{ marginBottom: "16px" }}>
                              <label className="form-label">Clasificación del Medicamento:</label>
                              <div style={{ display: "flex", background: "#f1f5f9", padding: "3px", borderRadius: "8px", width: "100%", maxWidth: "320px", opacity: isModoGlobal ? 1 : 0.65 }}>
                                <button
                                  type="button"
                                  onClick={() => { if (isModoGlobal) setEditEsGenerico(false); }}
                                  style={{
                                    flex: 1,
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: isModoGlobal ? "pointer" : "not-allowed",
                                    background: !editEsGenerico ? "#ffffff" : "transparent",
                                    color: !editEsGenerico ? "#0f172a" : "#64748b",
                                    boxShadow: !editEsGenerico ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  Marca
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { if (isModoGlobal) setEditEsGenerico(true); }}
                                  style={{
                                    flex: 1,
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: isModoGlobal ? "pointer" : "not-allowed",
                                    background: editEsGenerico ? "#ffffff" : "transparent",
                                    color: editEsGenerico ? "#0f172a" : "#64748b",
                                    boxShadow: editEsGenerico ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  Genérico
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">
                              {editTipoPlantilla === "medicamento" ? (editEsGenerico ? "Nombre del Genérico:" : "Nombre Comercial:") : "Nombre del Producto:"}
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              placeholder={editTipoPlantilla === "medicamento" ? (editEsGenerico ? "Ej. Paracetamol" : "Ej. Panadol") : "Ej. Oso de Peluche con Corazón 30cm"}
                              value={editNombreComercial}
                              onChange={(e) => setEditNombreComercial(e.target.value)}
                              disabled={!isModoGlobal}
                            />
                          </div>
                          <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">
                                {editTipoPlantilla === "medicamento" ? "Categorías terapéuticas:" : "Categoría:"}
                              </label>
                              <CustomMultiSelect
                                options={categorias.map(c => ({ value: c.id.toString(), label: c.nombre }))}
                                value={editCategoriasIds}
                                onChange={setEditCategoriasIds}
                                placeholder="Seleccione categorías"
                                onCreateNew={() => handleOpenQuickModal("categoria", -1, "edit")}
                                onCreateNewLabel="+ Crear Categoría"
                                disabled={!isModoGlobal}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                               <label className="form-label">
                                 {editTipoPlantilla === "medicamento" ? "Laboratorio:" : "Marca / Fabricante:"}
                               </label>
                               <CustomSelect
                                 options={laboratorios.map(l => ({ value: l.id.toString(), label: l.nombre }))}
                                 value={editLaboratorioId}
                                 onChange={setEditLaboratorioId}
                                 placeholder="Seleccione marca"
                                 onCreateNew={() => handleOpenQuickModal("laboratorio", -1, "edit")}
                                 onCreateNewLabel="+ Crear Laboratorio"
                                 disabled={!isModoGlobal}
                               />
                             </div>
                           </div>
                           {editTipoPlantilla === "medicamento" && (
                             <div className="form-row" style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
                               <div className="form-group" style={{ flex: 1 }}>
                                 <label className="form-label">Forma Farmacéutica:</label>
                                 <CustomSelect
                                   options={formasFarmaceuticas.map(f => ({ value: f.id.toString(), label: f.nombre }))}
                                   value={editFormaFarmaceuticaId}
                                   onChange={setEditFormaFarmaceuticaId}
                                   placeholder="Seleccione forma"
                                   onCreateNew={() => handleOpenQuickModal("formaFarmaceutica", -1, "edit")}
                                   onCreateNewLabel="+ Crear Forma Farmacéutica"
                                   disabled={!isModoGlobal}
                                 />
                               </div>
                               <div style={{ flex: 1 }} />
                             </div>
                           )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "14px", borderTop: "1.5px solid #f1f5f9" }}>
                        <button type="button" className="btn btn-outline" onClick={() => { setShowProductModal(false); setSelectedProduct(null); }} style={{ flex: 1 }}>
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            if (editTipoPlantilla === "medicamento") {
                              setEditProductModalTab("formulacion");
                            } else {
                              setEditProductModalTab("empaque");
                            }
                          }}
                          style={{ flex: 1 }}
                        >
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}

                  {editProductModalTab === "formulacion" && editTipoPlantilla === "medicamento" && (
                    <>
                      <div className="admin-modal-header" style={{ marginBottom: "12px" }}>
                        <div>
                          <h3 className="admin-modal-title" style={{ margin: 0, fontSize: "1.1rem" }}>Formulación</h3>
                          <p className="admin-modal-subtitle" style={{ margin: 0, fontSize: "0.68rem", color: "#64748b" }}>PRINCIPIOS ACTIVOS Y ESPECIFICACIONES TÉCNICAS</p>
                        </div>
                      </div>

                      {!isModoGlobal && (
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px 14px", color: "#1e40af", fontSize: "0.75rem", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center", lineHeight: "1.4" }}>
                          <span>ℹ️ <strong>Modo Sucursal ({sucursales.find(s => s.id === getActiveSucursalId())?.nombre}):</strong> Solo se pueden modificar los precios para esta sucursal. Los detalles globales del producto son de solo lectura.</span>
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "12px" }}>
                            <FlaskConical size={14} style={{ color: "#e11d48" }} />
                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Formulación y Principios Activos</span>
                          </div>

                          <div className="form-group" style={{ marginBottom: "16px" }}>
                            <label className="form-label">Compuestos / Principios Activos (Dato + Dosis):</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {editCompuestos.map((comp, idx) => (
                                <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                  <div style={{ flex: 2 }}>
                                    <CustomSelect
                                      options={compuestosList.map(c => ({ value: c.id.toString(), label: c.nombre }))}
                                      value={comp.compuestoId}
                                      onChange={(val) => {
                                        const newComps = [...editCompuestos];
                                        newComps[idx] = { ...newComps[idx], compuestoId: val };
                                        setEditCompuestos(newComps);
                                      }}
                                      placeholder="Compuesto"
                                      onCreateNew={() => handleOpenQuickModal("compuesto", idx, "edit")}
                                      onCreateNewLabel="+ Crear Compuesto"
                                      disabled={!isModoGlobal}
                                    />
                                  </div>
                                  <div style={{ flex: 1.2, display: "flex", gap: "4px" }}>
                                    <input
                                      type="text"
                                      className="input-field"
                                      placeholder="Dosis (Ej. 500)"
                                      value={comp.valor}
                                      onChange={(e) => {
                                        const newComps = [...editCompuestos];
                                        newComps[idx] = { ...newComps[idx], valor: e.target.value };
                                        setEditCompuestos(newComps);
                                      }}
                                      style={{ flex: 1, minWidth: "60px" }}
                                      disabled={!isModoGlobal}
                                    />
                                    <CustomSelect
                                      options={unidadesMedidaList.map(u => ({ value: u.nombre, label: u.nombre }))}
                                      value={comp.unidad}
                                      onChange={(val) => {
                                        const newComps = [...editCompuestos];
                                        newComps[idx] = { ...newComps[idx], unidad: val };
                                        setEditCompuestos(newComps);
                                      }}
                                      placeholder="U."
                                      width="105px"
                                      onCreateNew={() => handleOpenQuickModal("unidadMedida", idx, "edit")}
                                      onCreateNewLabel="+ Crear Unidad"
                                      disabled={!isModoGlobal}
                                    />
                                  </div>
                                  {editCompuestos.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setEditCompuestos(editCompuestos.filter((_, i) => i !== idx))}
                                      style={{
                                        padding: "0 10px",
                                        height: "42px",
                                        border: "1.5px solid #fda4af",
                                        borderRadius: "10px",
                                        background: "#fff1f2",
                                        color: "#e11d48",
                                        cursor: isModoGlobal ? "pointer" : "not-allowed",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        flexShrink: 0,
                                        opacity: isModoGlobal ? 1 : 0.65
                                      }}
                                      disabled={!isModoGlobal}
                                    >
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditCompuestos([...editCompuestos, { compuestoId: "", valor: "", unidad: "mg" }])}
                              style={{
                                marginTop: "8px",
                                padding: "6px 12px",
                                border: "1.5px solid #e2e8f0",
                                borderRadius: "10px",
                                background: "#f8fafc",
                                color: "#475569",
                                cursor: isModoGlobal ? "pointer" : "not-allowed",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                opacity: isModoGlobal ? 1 : 0.65
                              }}
                              disabled={!isModoGlobal}
                            >
                              <Plus size={12} />
                              Añadir compuesto
                            </button>
                          </div>

                          <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Concentración (Auto-generado):</label>
                              <input
                                type="text"
                                className="input-field"
                                style={{ backgroundColor: "#f1f5f9", cursor: "not-allowed" }}
                                placeholder="Se calculará de los compuestos"
                                value={editCompuestos.map(c => c.valor && c.valor.trim() ? `${c.valor.trim()} ${c.unidad}`.trim() : "").filter(c => c !== "").join(" + ")}
                                readOnly
                              />
                            </div>
                            <div style={{ flex: 1 }} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "14px", borderTop: "1.5px solid #f1f5f9" }}>
                        <button type="button" className="btn btn-outline" onClick={() => setEditProductModalTab("general")} style={{ flex: 1 }}>
                          Atrás
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => setEditProductModalTab("empaque")} style={{ flex: 1 }}>
                          Siguiente
                        </button>
                      </div>
                    </>
                  )}

                  {editProductModalTab === "empaque" && (
                    <>
                      <div className="admin-modal-header" style={{ marginBottom: "12px" }}>
                        <div>
                          <h3 className="admin-modal-title" style={{ margin: 0, fontSize: "1.1rem" }}>
                            {editTipoPlantilla === "medicamento" ? "Empaque y Stock" : "Empaque y Stock"}
                          </h3>
                          <p className="admin-modal-subtitle" style={{ margin: 0, fontSize: "0.68rem", color: "#64748b" }}>EMPAQUE, LOGÍSTICA, STOCK Y PRECIOS</p>
                        </div>
                      </div>

                      {!isModoGlobal && (
                        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px 14px", color: "#1e40af", fontSize: "0.75rem", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center", lineHeight: "1.4" }}>
                          <span>ℹ️ <strong>Modo Sucursal ({sucursales.find(s => s.id === getActiveSucursalId())?.nombre}):</strong> Solo se pueden modificar los precios para esta sucursal. Los detalles globales del producto son de solo lectura.</span>
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: "18px", flex: 1, overflowY: "auto", paddingRight: "4px" }}>
                        {/* SECCIÓN PRESENTACIÓN */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "12px" }}>
                            <Barcode size={14} style={{ color: "#e11d48" }} />
                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Empaque y Logística</span>
                          </div>
                          <div className="form-row" style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Presentación:</label>
                              <CustomSelect
                                options={[{ value: "Caja", label: "Caja" }, { value: "Unitario", label: "Unitario" }]}
                                value={editPresentacion}
                                onChange={(val) => {
                                  setEditPresentacion(val);
                                  if (val === "Unitario") {
                                    setEditCantPresentacion("1");
                                    setEditCantPresentacionBlister("1");
                                  } else {
                                    setEditContenidoNetoValor("");
                                    setEditContenidoNetoUnidad("ml");
                                  }
                                }}
                                disabled={!isModoGlobal}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label className="form-label">Código de Barras:</label>
                              <input type="text" className="input-field" placeholder="Ej. 7751234567890" value={editCodigoBarras} onChange={(e) => setEditCodigoBarras(e.target.value)} disabled={!isModoGlobal} />
                            </div>
                          </div>
                          {editPresentacion === "Caja" && (
                            <div className="form-row" style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Unidades por Caja:</label>
                                <input type="number" min="0" className="input-field" value={editCantPresentacion} onChange={(e) => setEditCantPresentacion(e.target.value)} disabled={!isModoGlobal} />
                              </div>
                              {editTipoPlantilla === "medicamento" && (
                                <div className="form-group" style={{ flex: 1 }}>
                                  <label className="form-label">Unidades por Blíster:</label>
                                  <input type="number" min="0" className="input-field" value={editCantPresentacionBlister} onChange={(e) => setEditCantPresentacionBlister(e.target.value)} disabled={!isModoGlobal} />
                                </div>
                              )}
                            </div>
                          )}
                          {editTipoPlantilla === "medicamento" && editPresentacion === "Unitario" && (
                            <div className="form-row" style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Contenido Neto (Volumen/Peso):</label>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    className="input-field"
                                    placeholder="Ej. 100"
                                    value={editContenidoNetoValor}
                                    onChange={(e) => setEditContenidoNetoValor(e.target.value)}
                                    style={{ flex: 1 }}
                                    disabled={!isModoGlobal}
                                  />
                                  <CustomSelect
                                    options={[
                                      { value: "ml", label: "ml" },
                                      { value: "g", label: "g" },
                                      { value: "L", label: "L" },
                                      { value: "oz", label: "oz" },
                                      { value: "mg", label: "mg" },
                                      { value: "mcg", label: "mcg" },
                                    ]}
                                    value={editContenidoNetoUnidad}
                                    onChange={setEditContenidoNetoUnidad}
                                    width="100px"
                                    disabled={!isModoGlobal}
                                  />
                                </div>
                                <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                                  Opcional. Para jarabes, cremas, gotas, etc.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SECCIÓN PRECIOS */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "12px", marginTop: "8px" }}>
                            <TrendingUp size={14} style={{ color: "#e11d48" }} />
                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Precios de Venta (S/)</span>
                          </div>
                          {editPresentacion === "Caja" ? (
                            <>
                              <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                  <label className="form-label">Precio Caja:</label>
                                  <input type="number" step="0.01" min="0" className="input-field" value={precioCaja} onChange={(e) => setPrecioCaja(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                  <label className="form-label">Precio Unidad:</label>
                                  <input type="number" step="0.01" min="0" className="input-field" value={precioUnidad} onChange={(e) => setPrecioUnidad(e.target.value)} />
                                </div>
                              </div>
                              <div className="form-row" style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                  <label className="form-label">Precio Blíster:</label>
                                  <input type="number" step="0.01" min="0" className="input-field" value={precioBlister} onChange={(e) => setPrecioBlister(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }} />
                              </div>
                            </>
                          ) : (
                            <div className="form-row" style={{ display: "flex", gap: "14px" }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Precio Unidad:</label>
                                <input type="number" step="0.01" min="0" className="input-field" value={precioUnidad} onChange={(e) => setPrecioUnidad(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SECCIÓN COSTOS */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1.5px solid #f1f5f9", paddingBottom: "6px", marginBottom: "12px", marginTop: "8px" }}>
                            <Package size={14} style={{ color: "#e11d48" }} />
                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Costos de Adquisición (S/)</span>
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Costo (S/):</label>
                            <input type="number" step="0.01" min="0" className="input-field" value={costo} onChange={(e) => setCosto(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "12px", marginTop: "auto", paddingTop: "16px", borderTop: "1.5px solid #f1f5f9" }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            if (editTipoPlantilla === "medicamento") {
                              setEditProductModalTab("formulacion");
                            } else {
                              setEditProductModalTab("general");
                            }
                          }}
                          style={{ flex: 1 }}
                        >
                          Atrás
                        </button>
                        <button 
                          className="btn btn-primary" 
                          onClick={handleSaveAllProductAndInventory} 
                          style={{ flex: 1, opacity: isSaving ? 0.7 : 1, cursor: isSaving ? "not-allowed" : "pointer" }}
                          disabled={isSaving}
                        >
                          {isSaving ? "Guardando..." : "Guardar Cambios"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showQuickModal && (
          <div className="admin-modal-overlay-centered overlay-bg-blur" style={{ zIndex: 200 }}>
            <div className="admin-modal-card-centered" style={{ maxWidth: "420px" }}>
              <button
                className="admin-modal-close-btn"
                onClick={() => setShowQuickModal(false)}
              >
                <X size={18} />
              </button>
              
              <h3 className="admin-modal-title">
                {quickModalType === "laboratorio" && "Nuevo Laboratorio"}
                {quickModalType === "categoria" && "Nueva Categoría"}
                {quickModalType === "formaFarmaceutica" && "Nueva Forma Farmacéutica"}
                {quickModalType === "compuesto" && "Nuevo Compuesto"}
                {quickModalType === "unidadMedida" && "Nueva Unidad de Medida"}
              </h3>
              <p className="admin-modal-subtitle">
                CREACIÓN RÁPIDA DE DATO
              </p>
 
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label" style={{ marginBottom: "8px", display: "block" }}>
                  Nombre:
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={
                    quickModalType === "laboratorio" ? "Ej. Laboratorios Roche" :
                    quickModalType === "categoria" ? "Ej. Antiinflamatorios" :
                    quickModalType === "formaFarmaceutica" ? "Ej. Jarabe" :
                    quickModalType === "compuesto" ? "Ej. Ibuprofeno" :
                    "Ej. mg/ml"
                  }
                  value={quickModalValue}
                  onChange={(e) => {
                    setQuickModalValue(e.target.value);
                    if (quickModalError) setQuickModalError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveQuickModal();
                    }
                  }}
                  autoFocus
                />
                {quickModalError && (
                  <p style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} /> {quickModalError}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowQuickModal(false)}
                  disabled={quickModalLoading}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveQuickModal}
                  disabled={quickModalLoading}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  {quickModalLoading ? "Guardando..." : "Guardar"}
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

        /* SaaS Double-line cell */
        .admin-prod-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .admin-prod-name {
          font-size: 0.85rem;
          font-weight: 400;
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
          font-weight: 400;
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
        }

        .admin-badge-stock {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 400;
          background: #f1f5f9;
          border: 1px solid rgba(15,23,42,0.06);
        }

        .badge-stock-success,
        .badge-stock-warning,
        .badge-stock-danger {
          color: #475569;
        }

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

        .spin {
          animation: spin-animation 1s linear infinite;
        }
        @keyframes spin-animation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}