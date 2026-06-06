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
    tipoProducto: string | null;
    cantidadPresentacion: number | null;
    cantidadPresentacionBlister: number | null;
  };
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener items del carrito de la base de datos
  const fetchCart = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/carrito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId, cantidad, precioVenta, tipoVenta }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al agregar al carrito");
      }

      // Volver a cargar el carrito para asegurar sincronía
      await fetchCart();
      return true;
    } catch (err: any) {
      setError(err.message || "Error al procesar adición");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar cantidad de un item
  const updateQuantity = async (itemId: number, nuevaCantidad: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/carrito/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: nuevaCantidad }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al actualizar cantidad");
      }

      await fetchCart();
      return true;
    } catch (err: any) {
      setError(err.message || "Error al actualizar cantidad");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Eliminar un item individual
  const removeItem = async (itemId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/carrito/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al eliminar item");
      }

      await fetchCart();
      return true;
    } catch (err: any) {
      setError(err.message || "Error al eliminar item");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Vaciar el carrito
  const clearCart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/carrito", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Error al vaciar el carrito");
      }

      setItems([]);
      return true;
    } catch (err: any) {
      setError(err.message || "Error al vaciar");
      console.error(err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Finalizar compra (cobrar)
  const checkout = async (pagoCon: number, vuelto: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/carrito/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagoCon, vuelto }),
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
