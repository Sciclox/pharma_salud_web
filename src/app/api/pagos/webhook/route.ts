import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { completarVenta } from "@/lib/ventas";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventName = body?.evento || body?.type || body?.object;
    const rawData = body?.data || body;

    console.log("Webhook recibido:", { eventName, rawData });

    // Culqi a veces envía "data" como un string JSON
    let dataObj = rawData;
    if (typeof rawData === "string") {
      try {
        dataObj = JSON.parse(rawData);
      } catch (e) {
        console.error("Error al parsear data del webhook como JSON:", e);
      }
    }

    const orderId = dataObj?.metadata?.order_id || dataObj?.order_id || dataObj?.id;
    const state = dataObj?.state || dataObj?.status || dataObj?.outcome?.type;

    // Verificar si el evento indica que el pago fue completado
    const esPagoExitoso =
      eventName === "charge.completed" ||
      eventName === "charge" ||
      eventName?.includes("charge") ||
      (eventName?.includes("order") && state === "paid");

    console.log("Evaluación de pago en Webhook:", { orderId, state, esPagoExitoso });

    if (esPagoExitoso && orderId) {
      console.log("Buscando venta pendiente por referenciaPago:", orderId);

      const ventaPendiente = await prisma.registroVentas.findFirst({
        where: {
          referenciaPago: orderId,
          estado: "pendiente",
        },
        include: { detalles: true },
      });

      if (ventaPendiente) {
        console.log("Venta pendiente encontrada:", ventaPendiente.id);

        // Completar la venta llamando a la biblioteca compartida directamente
        try {
          await completarVenta(ventaPendiente.id);
          console.log("Venta completada exitosamente via webhook:", ventaPendiente.id);
        } catch (errComplete: any) {
          console.error("Error al completar venta desde webhook:", errComplete);
        }
      } else {
        console.log("No se encontró venta pendiente para:", orderId);
      }
    } else {
      console.log("Evento ignorado o sin ID de orden válido:", { eventName, orderId });
    }

    return NextResponse.json({ message: "OK" });
  } catch (error) {
    console.error("Error en webhook:", error);
    return NextResponse.json({ message: "OK" }, { status: 200 });
  }
}


