import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCulqiOrder } from "@/lib/culqi";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
    }

    const order = await getCulqiOrder(orderId);

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada en Culqi" }, { status: 404 });
    }

    const pagado = order.state === "paid";

    return NextResponse.json({
      success: true,
      pagado,
      estado: order.state,
      orderId: order.id,
      total: order.amount / 100,
    });
  } catch (error: any) {
    console.error("Error al verificar pago:", error);
    return NextResponse.json(
      { error: error.message || "Error al verificar pago" },
      { status: 500 }
    );
  }
}
