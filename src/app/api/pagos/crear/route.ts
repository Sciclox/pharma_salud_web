import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCulqiOrder } from "@/lib/culqi";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user.sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { monto, descripcion, referencia } = body;

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const orderNumber = `POS-${session.user.id}-${Date.now()}`;
    const baseUrl = `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host") || "localhost:3000"}`;
    const descripcionFinal = descripcion && descripcion.length >= 5 
      ? descripcion 
      : `Venta POS #${orderNumber}`;

    const order = await createCulqiOrder({
      amount: monto,
      description: descripcionFinal,
      orderNumber,
      baseUrl,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      chargeUrl: order.url_pe || `https://checkout.culqi.com/v2/${order.id}`,
      qrUrl: order.qr || null,
      orderNumber,
      status: order.state,
      publicKey: process.env.CULQI_PUBLIC_KEY || null,
      rsaId: process.env.CULQI_RSA_ID || null,
      rsaPublicKey: process.env.CULQI_RSA_PUBLIC_KEY || null,
    });
  } catch (error: any) {
    console.error("Error al crear pago Culqi:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el pago" },
      { status: 500 }
    );
  }
}
