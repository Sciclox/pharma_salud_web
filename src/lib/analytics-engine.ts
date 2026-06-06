import prisma from "@/lib/prisma";

export interface AnalisisProducto {
  id: number;
  nombreProducto: string;
  tipoProducto: string | null;
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

/**
 * Ejecuta el algoritmo de análisis predictivo de inventario para una sucursal específica.
 * Replica de forma fiel el comportamiento de ProductoService.dart en Flutter.
 * 
 * @param sucursalId ID de la sucursal a analizar
 */
export async function analizarInventarioSucursal(sucursalId: number): Promise<AnalisisProducto[]> {
  // 1. Cargar todos los productos con su inventario local y lotes de vencimiento
  const productos = await prisma.producto.findMany({
    include: {
      inventarios: {
        where: { sucursalId },
      },
      fechasVencimiento: {
        where: { sucursalId },
      },
    },
  });

  // Ventas de las últimas 12 semanas para calcular la tasa de venta diaria
  const doceSemanasAtras = new Date();
  doceSemanasAtras.setDate(doceSemanasAtras.getDate() - 12 * 7);

  const detallesVenta = await prisma.detalleVenta.findMany({
    where: {
      fecha: { gte: doceSemanasAtras },
      registroVenta: {
        sucursalId,
      },
      devolucion: "No", // Excluir devoluciones
    },
    include: {
      producto: {
        select: {
          cantidadPresentacion: true,
          cantidadPresentacionBlister: true,
        },
      },
    },
  });

  const analizados: AnalisisProducto[] = [];

  // Agrupar ventas por producto
  const ventasPorProducto = new Map<number, typeof detallesVenta>();
  detallesVenta.forEach((det) => {
    const list = ventasPorProducto.get(det.productoId) || [];
    list.push(det);
    ventasPorProducto.set(det.productoId, list);
  });

  // Procesar cada producto
  for (const prod of productos) {
    const inv = prod.inventarios[0];
    if (!inv) continue; // Si no tiene inventario en esta sucursal, omitir

    const factorCaja = prod.cantidadPresentacion || 100;
    const factorBlister = prod.cantidadPresentacionBlister || 10;

    // A. Calcular Stock Útil (Stock Físico - Lotes ya Vencidos)
    const hoy = new Date();
    const lotesVencidos = prod.fechasVencimiento.filter(l => new Date(l.fechaVencimiento) < hoy);
    const cantidadVencida = lotesVencidos.reduce((acc, l) => acc + l.cantidad, 0);

    const stockFisico = inv.cantidadTotal;
    const stockUtil = Math.max(0, stockFisico - cantidadVencida);

    // Formatear stock útil en texto legible
    const stockCajas = Math.floor(stockUtil / factorCaja);
    const stockUnidades = stockUtil % factorCaja;
    const stockUtilTxt = `${stockCajas} cj + ${stockUnidades} und`;

    // B. Procesar historial de ventas de las últimas 12 semanas
    const ventasProd = ventasPorProducto.get(prod.id) || [];
    let totalUnidadesVendidas = 0;

    // Inicializar baldes semanales (12 semanas)
    const ventasSemanales = Array(12).fill(0);
    const unaSemanaMs = 7 * 24 * 60 * 60 * 1000;

    ventasProd.forEach((det) => {
      // Normalización a unidades físicas
      let unidades = det.cantidad;
      if (det.tipoVenta === "Venta por caja") {
        unidades = det.cantidad * factorCaja;
      } else if (det.tipoVenta === "Venta por blíster") {
        unidades = det.cantidad * factorBlister;
      }

      totalUnidadesVendidas += unidades;

      // Ubicar en qué balde semanal cae (0 es la más reciente, 11 la más antigua)
      const diffMs = hoy.getTime() - new Date(det.fecha).getTime();
      const semIndex = Math.floor(diffMs / unaSemanaMs);
      if (semIndex >= 0 && semIndex < 12) {
        ventasSemanales[semIndex] += unidades;
      }
    });

    // C. Calcular W-VPM (Weighted Daily Sales Velocity)
    // Formula original: 50% mes reciente + 30% consumo último lote (Kardex) + 20% promedio histórico
    // Por simplicidad del modelo web consolidado (sin DBF legacy), ponderaremos:
    // - 60% promedio últimas 4 semanas (reciente)
    // - 40% promedio histórico completo (últimas 12 semanas)
    const ventasMesReciente = ventasSemanales.slice(0, 4).reduce((a, b) => a + b, 0);
    const tasaDiariaReciente = (ventasMesReciente / 28); // 4 semanas

    const tasaDiariaHistorica = (totalUnidadesVendidas / 84); // 12 semanas (84 días)

    let tasaDiariaPonderada = (0.6 * tasaDiariaReciente) + (0.4 * tasaDiariaHistorica);

    // D. Analizar Volatilidad (Desviación Estándar de las ventas semanales)
    const promedioSemanal = totalUnidadesVendidas / 12;
    const varianza = ventasSemanales.reduce((acc, val) => acc + Math.pow(val - promedioSemanal, 2), 0) / 12;
    const desvEstandar = Math.sqrt(varianza);

    // Factor de seguridad por volatilidad (Alta volatilidad requiere más stock de seguridad)
    const factorVolatilidad = desvEstandar > promedioSemanal * 0.5 ? 1.35 : 1.15;

    // E. Calcular Stock de Seguridad
    // Formula: tasaDiaria × (Ciclo de reposición / 2) × factorVolatilidad. Asumimos ciclo de 14 días.
    const cicloReposicion = 14;
    const stockSeguridad = Math.round(tasaDiariaPonderada * (cicloReposicion / 2) * factorVolatilidad);

    // F. Calcular Compra Mensual Sugerida
    // Formula: demanda estimada mensual (tasa × 30) + stock de seguridad - stock útil
    const demandaMes = Math.round(tasaDiariaPonderada * 30);
    let compraMensualSugerida = Math.max(0, demandaMes + stockSeguridad - stockUtil);

    // Formatear sugerencia de compra a formato visual cajas + unidades
    const sugeridoCajas = Math.floor(compraMensualSugerida / factorCaja);
    const sugeridoUnidades = compraMensualSugerida % factorCaja;
    let compraSugeridaTxt = "ESTABLE";
    
    if (compraMensualSugerida > 0) {
      compraSugeridaTxt = `${sugeridoCajas} cj + ${sugeridoUnidades} und`;
    }

    // G. Estimar Días Restantes de Stock
    let diasRestantes = 999;
    if (tasaDiariaPonderada > 0) {
      diasRestantes = Math.round(stockUtil / tasaDiariaPonderada);
    } else if (stockUtil === 0) {
      diasRestantes = 0;
    }

    // H. Clasificación de Recomendaciones y Alertas
    let recomendacion: AnalisisProducto["recomendacion"] = "ESTABLE";
    if (stockUtil === 0) {
      recomendacion = "SIN STOCK";
    } else if (diasRestantes < 7) {
      recomendacion = "URGENTE";
    } else if (diasRestantes < 15) {
      recomendacion = "POR AGOTARSE";
    } else if (diasRestantes < 30) {
      recomendacion = "REPOSICIÓN PREVENTIVA";
    } else if (diasRestantes > 90 && stockUtil > 2 * factorCaja) {
      // Exceso de stock para más de 3 meses y stock mayor a 2 cajas
      recomendacion = "SOBRESTOCK";
    } else if (totalUnidadesVendidas === 0) {
      recomendacion = "SIN MOVIMIENTO";
    }

    // I. Tendencia
    let tendencia: AnalisisProducto["tendencia"] = "ESTABLE";
    if (tasaDiariaReciente > tasaDiariaHistorica * 1.1) {
      tendencia = "EN AUMENTO";
    } else if (tasaDiariaReciente < tasaDiariaHistorica * 0.9) {
      tendencia = "EN DESCENSO";
    }

    // J. Margen de Ganancia
    const precioUnidad = inv.precioUnidad;
    const costoUnidad = inv.costoUnidad;
    let margenPorcentaje = 0;
    if (precioUnidad > 0 && costoUnidad > 0) {
      margenPorcentaje = Math.round(((precioUnidad - costoUnidad) / precioUnidad) * 100);
    }

    // K. Es un Top Venta
    // Si representa más del 5% de las ventas totales del periodo
    const esTopVenta = totalUnidadesVendidas > 0 && totalUnidadesVendidas > (detallesVenta.length * 0.05);

    analizados.push({
      id: prod.id,
      nombreProducto: prod.nombreProducto,
      tipoProducto: prod.tipoProducto,
      stockUtil,
      stockUtilTxt,
      totalVendidas: totalUnidadesVendidas,
      tendencia,
      recomendacion,
      diasRestantes,
      margenPorcentaje,
      compraMensualSugerida,
      compraSugeridaTxt,
      esTopVenta,
    });
  }

  return analizados;
}
