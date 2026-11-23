import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  id: number;
  productoId: number;
  sucursalId: number;
  idUsuario: number;
  cantidad: number;
  precioVenta: number;
  tipoVenta: string;
  fecha: string;
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
  };
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener items del carrito de la base de datos
  const fetchCart = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/carrito");
      if (!res.ok) {
        throw new Error("Error al obtener los datos del carrito");
      }
      const data = await res.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Error de red");
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Cargar el carrito al montar el hook
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Agregar item al carrito
  const addToCart = async (
    productoId: number,
    cantidad: number,
    precioVenta: number,
    tipoVenta: string
  ) => {
    setError(null);
    try {
      const res = await fetch("/api/carrito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId, cantidad, precioVenta, tipoVenta }),
      });

      if (!res.ok) {
        const errData = await res.json();
        const errMsg = errData.error || "Error al agregar al carrito";
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      // Insertar/actualizar en estado local directamente con el item devuelto
      const newItem = await res.json();

      if (newItem.id) {
        setItems(prev => {
          const idx = prev.findIndex(i => i.id === newItem.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = newItem;
            return updated;
          }
          return [...prev, newItem];
        });
      } else {
        // Caso "Item eliminado del carrito" (nuevaCantidad <= 0)
        await fetchCart(true);
      }

      return { success: true };
    } catch (err: any) {
      const errMsg = err.message || "Error al procesar adición";
      setError(errMsg);
      console.error(err);
      return { success: false, error: errMsg };
    }
  };

  // Actualizar cantidad de un item
  const updateQuantity = async (itemId: number, nuevaCantidad: number) => {
    const previousItems = items;
    // Actualización optimista instantánea en memoria
    setItems(prevItems => prevItems.map(item => 
      item.id === itemId ? { ...item, cantidad: nuevaCantidad } : item
    ));
    setError(null);

    try {
      const res = await fetch(`/api/carrito/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: nuevaCantidad }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || "Error al actualizar cantidad");
        // Revertir estado si falla
        setItems(previousItems);
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || "Error al actualizar cantidad");
      console.error(err);
      // Revertir estado si falla
      setItems(previousItems);
      return false;
    }
  };

  // Eliminar un item individual
  const removeItem = async (itemId: number) => {
    const previousItems = items;
    // Actualización optimista instantánea en memoria
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
    setError(null);

    try {
      const res = await fetch(`/api/carrito/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || "Error al eliminar item");
        // Revertir estado si falla
        setItems(previousItems);
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || "Error al eliminar item");
      console.error(err);
      // Revertir estado si falla
      setItems(previousItems);
      return false;
    }
  };

  // Vaciar el carrito
  const clearCart = async () => {
    const previousItems = items;
    // Actualización optimista instantánea en memoria
    setItems([]);
    setError(null);

    try {
      const res = await fetch("/api/carrito", {
        method: "DELETE",
      });

      if (!res.ok) {
        setError("Error al vaciar el carrito");
        // Revertir estado si falla
        setItems(previousItems);
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || "Error al vaciar");
      console.error(err);
      // Revertir estado si falla
      setItems(previousItems);
      return false;
    }
  };

  // Finalizar compra (cobrar)
  const checkout = async (pagoCon: number, vuelto: number, metodoPago?: string, referenciaPago?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/carrito/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagoCon, vuelto, metodoPago, referenciaPago }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al procesar la venta");
      }

      setItems([]); // Limpiar localmente
      return { success: true, ...data };
    } catch (err: any) {
      setError(err.message || "Error de red al cobrar");
      console.error(err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Calcular totales del carrito
  const getSubtotal = () => {
    return items.reduce((acc, item) => acc + item.cantidad * item.precioVenta, 0);
  };

  return {
    items,
    loading,
    error,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    checkout,
    getSubtotal,
    refresh: fetchCart,
  };
}
