import prisma from "@/lib/prisma";

/**
 * Calcula y actualiza el stock mínimo para un producto y sucursal específico,
 * basándose en las ventas reales de los últimos 30 días normalizadas a unidades.
 */
export async function calcularStockMinimoIndividual(
  productoId: number,
  sucursalId: number,
  txClient?: any
): Promise<number> {
  const db = txClient || prisma;

  // 1. Obtener el producto para saber su presentación y equivalencia en unidades
  const producto = await db.producto.findUnique({
    where: { id: productoId },
    select: {
      id: true,
      presentacion: true,
      cantidadPresentacion: true,
      cantidadPresentacionBlister: true,
    },
  });

  if (!producto) return 0;

  // Fallback mínimo por defecto según el tipo de presentación (1 Caja o 10 Unidades)
  const defaultMin = producto.presentacion === "Caja" 
    ? (producto.cantidadPresentacion || 100) 
    : 10;

  // 2. Obtener las ventas (DetalleVenta) de los últimos 30 días para este producto en esta sucursal
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);

  const ventas = await db.detalleVenta.findMany({
    where: {
      productoId,
      devolucion: "No", // Excluir devoluciones
      registroVenta: {
        sucursalId,
        fecha: { gte: fechaLimite },
      },
    },
    select: {
      cantidad: true,
      tipoVenta: true,
    },
  });

  // Normalizar las ventas a unidades físicas reales
  let totalVendidoUnidades = 0;
  for (const v of ventas) {
    if (v.tipoVenta === "Venta por caja") {
      totalVendidoUnidades += v.cantidad * (producto.cantidadPresentacion || 1);
    } else if (v.tipoVenta === "Venta por blíster") {
      totalVendidoUnidades += v.cantidad * (producto.cantidadPresentacionBlister || 1);
    } else {
      // Venta por unidad
      totalVendidoUnidades += v.cantidad;
    }
  }

  // Venta diaria promedio en los últimos 30 días
  const ventaDiariaPromedio = totalVendidoUnidades / 30;

  // Fórmula: (Venta Diaria Promedio * 3 días reposición) + (Venta Diaria Promedio * 2 días seguridad) = promedio * 5
  let stockMinimoCalculado = Math.ceil(ventaDiariaPromedio * 5);

  // Si el stock mínimo calculado es menor al mínimo por defecto, usar fallback
  if (stockMinimoCalculado < defaultMin) {
    stockMinimoCalculado = defaultMin;
  }

  // 3. Actualizar el inventario
  await db.inventarioSucursal.upsert({
    where: {
      productoId_sucursalId: {
        productoId,
        sucursalId,
      },
    },
    update: {
      stockMinimo: stockMinimoCalculado,
    },
    create: {
      productoId,
      sucursalId,
      cantidadTotal: 0,
      precioCaja: 0,
      precioUnidad: 0,
      costo: 0,
      stockMinimo: stockMinimoCalculado,
    },
  });

  return stockMinimoCalculado;
}

/**
 * Recalcula y actualiza los stocks mínimos para todos los productos en todas las sucursales,
 * basándose en el historial de ventas de los últimos 30 días normalizado a unidades.
 */
export async function recalcularTodosLosStocksMinimos(txClient?: any): Promise<number> {
  const db = txClient || prisma;

  // 1. Obtener todos los productos del catálogo central
  const productos = await db.producto.findMany({
    select: {
      id: true,
      presentacion: true,
      cantidadPresentacion: true,
      cantidadPresentacionBlister: true,
    },
  });

  // 2. Obtener todas las sucursales activas
  const sucursales = await db.sucursal.findMany({
    where: { estado: "activo" },
    select: { id: true },
  });

  // 3. Obtener todas las ventas no devueltas de los últimos 30 días
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);

  const ventas = await db.detalleVenta.findMany({
    where: {
      devolucion: "No",
      registroVenta: {
        fecha: { gte: fechaLimite },
      },
    },
    select: {
      productoId: true,
      cantidad: true,
      tipoVenta: true,
      registroVenta: {
        select: {
          sucursalId: true,
        },
      },
    },
  });

  // Crear un mapa de productos para búsqueda rápida
  const productoMap = new Map<number, typeof productos[0]>();
  for (const p of productos) {
    productoMap.set(p.id, p);
  }

  // Calcular la demanda total por combinación de sucursal y producto
  const ventasAgrupadas: Record<string, number> = {};
  for (const v of ventas) {
    const sId = v.registroVenta?.sucursalId;
    if (sId) {
      const key = `${sId}_${v.productoId}`;
      const prod = productoMap.get(v.productoId);
      
      let unidades = v.cantidad;
      if (prod) {
        if (v.tipoVenta === "Venta por caja") {
          unidades = v.cantidad * (prod.cantidadPresentacion || 1);
        } else if (v.tipoVenta === "Venta por blíster") {
          unidades = v.cantidad * (prod.cantidadPresentacionBlister || 1);
        }
      }
      
      ventasAgrupadas[key] = (ventasAgrupadas[key] || 0) + unidades;
    }
  }

  // Generar las operaciones de actualización
  const batchUpdates = [];
  let countUpdated = 0;

  for (const p of productos) {
    const defaultMin = p.presentacion === "Caja" ? (p.cantidadPresentacion || 100) : 10;

    for (const s of sucursales) {
      const key = `${s.id}_${p.id}`;
      const totalVendidoUnidades = ventasAgrupadas[key] || 0;
      const ventaDiariaPromedio = totalVendidoUnidades / 30;

      let stockMinimoCalculado = Math.ceil(ventaDiariaPromedio * 5);
      if (stockMinimoCalculado < defaultMin) {
        stockMinimoCalculado = defaultMin;
      }

      batchUpdates.push(
        db.inventarioSucursal.upsert({
          where: {
            productoId_sucursalId: {
              productoId: p.id,
              sucursalId: s.id,
            },
          },
          update: {
            stockMinimo: stockMinimoCalculado,
          },
          create: {
            productoId: p.id,
            sucursalId: s.id,
            cantidadTotal: 0,
            precioCaja: 0,
            precioUnidad: 0,
            costo: 0,
            stockMinimo: stockMinimoCalculado,
          },
        })
      );
      countUpdated++;
    }
  }

  // Si estamos usando el cliente global, hacemos chunks en transacciones
  if (db === prisma) {
    const chunkSize = 100;
    for (let i = 0; i < batchUpdates.length; i += chunkSize) {
      const chunk = batchUpdates.slice(i, i + chunkSize);
      await prisma.$transaction(chunk);
    }
  } else {
    // Si ya estamos dentro de una tx, ejecutamos secuencialmente todas
    await Promise.all(batchUpdates);
  }

  return countUpdated;
}
