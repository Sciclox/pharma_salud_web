import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { completarVenta } from "@/lib/ventas";

export async function POST(request: Request) {
  try {
    // 1. Validar autenticación
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Obtener y validar parámetros
    const body = await request.json();
    const { ventaId, number_phone, otp } = body;

    if (!ventaId || !number_phone || !otp) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios (ventaId, number_phone, otp)" },
        { status: 400 }
      );
    }

    if (!/^\d{9}$/.test(number_phone)) {
      return NextResponse.json(
        { error: "El número de celular debe tener exactamente 9 dígitos numéricos" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "El código de aprobación (OTP) debe tener exactamente 6 dígitos numéricos" },
        { status: 400 }
      );
    }

    // 3. Buscar venta pendiente en DB
    const venta = await prisma.registroVentas.findUnique({
      where: { id: Number(ventaId) },
    });

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    if (venta.estado !== "pendiente") {
      return NextResponse.json(
        { error: `La venta ya no está pendiente (estado actual: ${venta.estado})` },
        { status: 400 }
      );
    }

    // 4. Determinar si estamos en modo simulación
    const publicKey = process.env.CULQI_PUBLIC_KEY || "";
    const secretKey = process.env.CULQI_SECRET_KEY || "";
    const isSimulated = !secretKey || secretKey === "sk_test_xxxxxxxxxxxxx";

    if (isSimulated) {
      console.log("[SIMULATION] Procesando pago Yape Directo para venta:", venta.id);
      if (number_phone === "900000001") {
        const chargeId = `chg_sim_yape_${Date.now()}`;
        
        await prisma.registroVentas.update({
          where: { id: venta.id },
          data: { referenciaPago: chargeId },
        });

        await completarVenta(venta.id);
        return NextResponse.json({
          success: true,
          chargeId,
          message: "Pago con Yape completado con éxito (SIMULADO)",
        });
      } else {
        return NextResponse.json(
          { error: "Número no soportado en modo simulación. Use el número de prueba 900000001" },
          { status: 400 }
        );
      }
    }

    // 5. Flujo Real (Sandbox o Producción) con Culqi API
    const amountInCents = Math.round(Number(venta.total) * 100);

    // 5.1 Tokenizar celular + OTP en Culqi
    console.log("Tokenizando Yape en Culqi:", { number_phone, amount: amountInCents });
    const tokenResponse = await fetch("https://secure.culqi.com/v2/tokens/yape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number_phone,
        otp,
        amount: amountInCents,
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}));
      console.error("Error de tokenización Culqi:", errData);
      return NextResponse.json(
        {
          error:
            errData.user_message ||
            errData.merchant_message ||
            "El código OTP es inválido o ha expirado. Por favor, genere uno nuevo en su Yape."
        },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const tokenId = tokenData.id;

    // 5.2 Crear Cargo en Culqi usando el token
    console.log("Creando cargo Yape en Culqi con token:", tokenId);
    const chargeResponse = await fetch("https://api.culqi.com/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency_code: "PEN",
        email: "pos@farmacia.com",
        source_id: tokenId,
        description: `Pago Yape Directo POS - Venta #${venta.id}`,
      }),
    });

    if (!chargeResponse.ok) {
      const errData = await chargeResponse.json().catch(() => ({}));
      console.error("Error al crear cargo Culqi:", errData);
      return NextResponse.json(
        {
          error:
            errData.user_message ||
            errData.merchant_message ||
            "Error al realizar el cargo con Yape en la pasarela Culqi."
        },
        { status: 400 }
      );
    }

    const chargeData = await chargeResponse.json();
    const chargeId = chargeData.id;

    // 5.3 Actualizar referencia de pago en base de datos
    await prisma.registroVentas.update({
      where: { id: venta.id },
      data: { referenciaPago: chargeId },
    });

    // 5.4 Completar transacción de venta (inventario, kardex, lotes)
    try {
      await completarVenta(venta.id);
      console.log("Venta completada exitosamente tras cargo Yape:", venta.id);
    } catch (errComplete: any) {
      console.error("Error al completar venta tras pago exitoso:", errComplete);
      return NextResponse.json(
        {
          error:
            "El pago fue cobrado con éxito en Culqi, pero ocurrió un problema al registrar la salida de inventario: " +
            errComplete.message,
          chargeId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chargeId,
      message: "Pago con Yape completado con éxito",
    });
  } catch (error: any) {
    console.error("Error general en yape-directo API:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al procesar el pago Yape" },
      { status: 500 }
    );
  }
}
