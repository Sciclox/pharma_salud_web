import prisma from "../src/lib/prisma";
import { completarVenta } from "../src/lib/ventas";
import dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config();

const CULQI_PUBLIC_KEY = process.env.CULQI_PUBLIC_KEY || "";
const CULQI_SECRET_KEY = process.env.CULQI_SECRET_KEY || "";

async function runTest() {
  console.log("=== INICIANDO PRUEBA DE YAPE DIRECTO CON CULQI API ===");
  console.log("Llave Pública:", CULQI_PUBLIC_KEY ? "CONFIGURADA" : "NO CONFIGURADA");
  console.log("Llave Secreta:", CULQI_SECRET_KEY ? "CONFIGURADA" : "NO CONFIGURADA");

  if (!CULQI_PUBLIC_KEY || !CULQI_SECRET_KEY) {
    console.error("❌ Error: Se requieren las credenciales CULQI_PUBLIC_KEY y CULQI_SECRET_KEY en el archivo .env");
    return;
  }

  // 1. Obtener datos base para la prueba
  const usuario = await prisma.usuario.findFirst({
    where: { estado: "activo", NOT: { sucursalId: null } },
    include: { sucursal: true }
  });
  if (!usuario || !usuario.sucursal) {
    console.error("❌ Error: No se encontró ningún usuario activo con sucursal asignada.");
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

  // Asegurar lote
  let lote = await prisma.expiracionLote.findFirst({
    where: { productoId: producto.id, sucursalId: sucursal.id }
  });
  let loteCreadoTemp = false;
  if (!lote) {
    console.log("⚠️ No hay lote de expiración. Creando un lote temporal...");
    lote = await prisma.expiracionLote.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursal.id,
        cantidad: 100,
        fechaVencimiento: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      }
    });
    loteCreadoTemp = true;
  }
  const cantidadLoteInicial = lote.cantidad;

  // 2. Crear una venta pendiente de prueba en la base de datos
  const tempRef = `test_yape_dir_temp_${Date.now()}`;
  console.log(`🛒 Creando Venta Pendiente en base de datos...`);
  const venta = await prisma.registroVentas.create({
    data: {
      sucursalId: sucursal.id,
      usuarioId: usuario.id,
      total: 10.0,
      pagoCon: 10.0,
      vuelto: 0.0,
      metodoPago: "yape",
      referenciaPago: tempRef,
      estado: "pendiente",
      detalles: {
        create: {
          productoId: producto.id,
          nombreProducto: producto.nombreProducto,
          usuarioId: usuario.id,
          tipoVenta: "Venta por unidad",
          cantidad: 1,
          precioVenta: 10.0,
        }
      }
    },
    include: { detalles: true }
  });
  console.log(`✅ Venta creada con ID: ${venta.id}. Estado: ${venta.estado}`);

  // 3. Simular tokenización de Yape con Culqi API
  const testPhone = "900000001";
  const testOtp = "123456";
  const amountInCents = Math.round(Number(venta.total) * 100);

  console.log(`🔑 Paso 1: Generando Token de Yape en Culqi para Celular: ${testPhone}...`);
  try {
    const tokenRes = await fetch("https://secure.culqi.com/v2/tokens/yape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CULQI_PUBLIC_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number_phone: testPhone,
        otp: testOtp,
        amount: amountInCents,
      }),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      throw new Error(errData.user_message || errData.merchant_message || "Error al tokenizar Yape");
    }

    const tokenData = (await tokenRes.json()) as any;
    const tokenId = tokenData.id;
    console.log(`✅ Token de Yape creado con éxito: ${tokenId}`);

    // 4. Simular cargo en Culqi
    console.log(`💳 Paso 2: Generando Cargo en Culqi usando el token ${tokenId}...`);
    const chargeRes = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CULQI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency_code: "PEN",
        email: "pos@farmacia.com",
        source_id: tokenId,
        description: `Test Yape Directo POS - Venta #${venta.id}`,
      }),
    });

    if (!chargeRes.ok) {
      const errData = await chargeRes.json().catch(() => ({}));
      throw new Error(errData.user_message || errData.merchant_message || "Error al crear cargo");
    }

    const chargeData = (await chargeRes.json()) as any;
    const chargeId = chargeData.id;
    console.log(`✅ Cargo creado con éxito en Culqi: ${chargeId}`);

    // 5. Actualizar referencia y completar venta
    console.log("⚡ Paso 3: Actualizando referencia en la base de datos y completando la venta...");
    await prisma.registroVentas.update({
      where: { id: venta.id },
      data: { referenciaPago: chargeId },
    });

    await completarVenta(venta.id);

    // 6. Validaciones
    const ventaVerificada = await prisma.registroVentas.findUnique({
      where: { id: venta.id }
    });
    if (ventaVerificada?.estado === "completado") {
      console.log("⭐ [OK] El estado de la venta cambió exitosamente a 'completado'.");
    } else {
      console.error(`❌ [FAIL] El estado de la venta es ${ventaVerificada?.estado}.`);
    }

    const inventarioVerificado = await prisma.inventarioSucursal.findUnique({
      where: { productoId_sucursalId: { productoId: producto.id, sucursalId: sucursal.id } }
    });
    const stockEsperado = stockInicial - 1;
    if (inventarioVerificado?.cantidadTotal === stockEsperado) {
      console.log(`⭐ [OK] El stock disminuyó correctamente de ${stockInicial} a ${inventarioVerificado.cantidadTotal}.`);
    } else {
      console.error(`❌ [FAIL] El stock es ${inventarioVerificado?.cantidadTotal}, se esperaba ${stockEsperado}.`);
    }

  } catch (error: any) {
    console.error("❌ Ocurrió un error durante la prueba:", error.message);
  } finally {
    // Limpieza
    console.log("\n🧹 Limpiando base de datos para restaurar el estado original...");
    await prisma.kardex.deleteMany({
      where: { idDetalleVenta: venta.detalles[0].id }
    });
    await prisma.detalleVenta.deleteMany({
      where: { registroVentaId: venta.id }
    });
    await prisma.registroVentas.delete({
      where: { id: venta.id }
    });
    await prisma.inventarioSucursal.update({
      where: { productoId_sucursalId: { productoId: producto.id, sucursalId: sucursal.id } },
      data: { cantidadTotal: stockInicial }
    });
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

  console.log("=== FIN DE LA PRUEBA ===");
}

runTest()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
