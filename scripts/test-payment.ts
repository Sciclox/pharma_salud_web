import prisma from "../src/lib/prisma";
import { completarVenta } from "../src/lib/ventas";

async function runTest() {
  console.log("=== INICIANDO PRUEBA DE INTEGRACIÓN DE PAGOS (CULQI/YAPE) ===");

  // 1. Obtener datos base para la prueba (buscando un usuario activo con sucursal asignada primero)
  const usuario = await prisma.usuario.findFirst({
    where: { estado: "activo", NOT: { sucursalId: null } },
    include: { sucursal: true }
  });
  if (!usuario || !usuario.sucursal) {
    console.error("❌ Error: No se encontró ningún usuario activo con sucursal asignada en la base de datos.");
    return;
  }
  const sucursal = usuario.sucursal;
  console.log(`📍 Usando Sucursal: ${sucursal.nombre} (ID: ${sucursal.id})`);
  console.log(`👤 Usando Vendedor: ${usuario.nombreVendedor} (ID: ${usuario.id})`);

  // Buscar un producto que tenga inventario en esta sucursal
  const inventario = await prisma.inventarioSucursal.findFirst({
    where: { sucursalId: sucursal.id, cantidadTotal: { gt: 5 } },
    include: { producto: true }
  });
  if (!inventario) {
    console.error("❌ Error: No se encontró ningún producto con stock > 5 en la sucursal.");
    return;
  }
  const producto = inventario.producto;
  const stockInicial = inventario.cantidadTotal;
  console.log(`📦 Usando Producto: ${producto.nombreProducto} (ID: ${producto.id}) | Stock Inicial: ${stockInicial}`);

  // Asegurar que exista al menos un lote de expiración para este producto y sucursal para que el FIFO no falle
  let lote = await prisma.expiracionLote.findFirst({
    where: { productoId: producto.id, sucursalId: sucursal.id }
  });
  let loteCreadoTemp = false;
  if (!lote) {
    console.log("⚠️ No hay lote de expiración. Creando un lote temporal para evitar fallas de FIFO...");
    lote = await prisma.expiracionLote.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursal.id,
        cantidad: 100,
        fechaVencimiento: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 año
      }
    });
    loteCreadoTemp = true;
  }
  const cantidadLoteInicial = lote.cantidad;

  // 2. Crear una venta pendiente de prueba en la base de datos
  const referenciaPago = `test_sim_${Date.now()}`;
  console.log(`🛒 Creando Venta Pendiente con referencia: ${referenciaPago}...`);

  const venta = await prisma.registroVentas.create({
    data: {
      sucursalId: sucursal.id,
      usuarioId: usuario.id,
      total: 10.0,
      pagoCon: 10.0,
      vuelto: 0.0,
      metodoPago: "yape",
      referenciaPago,
      estado: "pendiente",
      detalles: {
        create: {
          productoId: producto.id,
          nombreProducto: producto.nombreProducto,
          usuarioId: usuario.id,
          tipoVenta: "Venta por unidad",
          cantidad: 2,
          precioVenta: 5.0,
        }
      }
    },
    include: { detalles: true }
  });
  console.log(`✅ Venta creada con ID: ${venta.id}. Estado: ${venta.estado}`);

  // 3. Ejecutar la función completarVenta (Simulación de lo que hace el Webhook/API)
  console.log(`⚡ Simulando procesamiento del Webhook llamando a completarVenta(${venta.id})...`);
  try {
    const result = await completarVenta(venta.id);
    console.log("✅ completarVenta ejecutado con éxito:", result);

    // 4. Verificar que la venta haya cambiado a "completado"
    const ventaVerificada = await prisma.registroVentas.findUnique({
      where: { id: venta.id }
    });
    if (ventaVerificada?.estado === "completado") {
      console.log("⭐ [OK] El estado de la venta cambió exitosamente a 'completado'.");
    } else {
      console.error(`❌ [FAIL] El estado de la venta es ${ventaVerificada?.estado}, se esperaba 'completado'.`);
    }

    // 5. Verificar que el inventario haya sido decrementado correctamente (cantidad = 2)
    const inventarioVerificado = await prisma.inventarioSucursal.findUnique({
      where: { productoId_sucursalId: { productoId: producto.id, sucursalId: sucursal.id } }
    });
    const stockEsperado = stockInicial - 2;
    if (inventarioVerificado?.cantidadTotal === stockEsperado) {
      console.log(`⭐ [OK] El stock en sucursal disminuyó de ${stockInicial} a ${inventarioVerificado.cantidadTotal} (Esperado: ${stockEsperado}).`);
    } else {
      console.error(`❌ [FAIL] El stock es ${inventarioVerificado?.cantidadTotal}, se esperaba ${stockEsperado}.`);
    }

    // 6. Verificar que se haya creado el movimiento en Kardex
    const kardex = await prisma.kardex.findFirst({
      where: { idDetalleVenta: venta.detalles[0].id }
    });
    if (kardex && kardex.cantidad === -2) {
      console.log(`⭐ [OK] Se registró el Kardex correspondiente: Tipo: ${kardex.tipoMovimiento}, Cantidad: ${kardex.cantidad}.`);
    } else {
      console.error("❌ [FAIL] No se encontró el registro de Kardex esperado.");
    }
  } catch (error: any) {
    console.error("❌ Error durante la ejecución de completarVenta:", error.message);
  } finally {
    // 7. LIMPIEZA DE BASE DE DATOS (Para no dejar basura ni alterar inventario real)
    console.log("\n🧹 Limpiando base de datos para restaurar el estado original...");
    
    // Eliminar Kardex si se creó
    await prisma.kardex.deleteMany({
      where: { idDetalleVenta: venta.detalles[0].id }
    });

    // Eliminar Detalles de Venta
    await prisma.detalleVenta.deleteMany({
      where: { registroVentaId: venta.id }
    });

    // Eliminar Cabecera de Venta
    await prisma.registroVentas.delete({
      where: { id: venta.id }
    });

    // Restaurar stock global en InventarioSucursal
    await prisma.inventarioSucursal.update({
      where: { productoId_sucursalId: { productoId: producto.id, sucursalId: sucursal.id } },
      data: { cantidadTotal: stockInicial }
    });

    // Restaurar o eliminar lote temporal
    if (loteCreadoTemp) {
      await prisma.expiracionLote.delete({ where: { id: lote.id } });
    } else {
      await prisma.expiracionLote.update({
        where: { id: lote.id },
        data: { cantidad: cantidadLoteInicial }
      });
    }

    console.log("✅ Base de datos restaurada correctamente.");
  }
  console.log("=== FIN DE LA PRUEBA DE INTEGRACIÓN ===");
}

runTest()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
