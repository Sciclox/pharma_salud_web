const CULQI_API_URL = "https://api.culqi.com/v2";

function isSandboxMode(): boolean {
  const key = process.env.CULQI_SECRET_KEY || "";
  return !key || key === "sk_test_xxxxxxxxxxxxx";
}

function getSecretKey(): string {
  const key = process.env.CULQI_SECRET_KEY || "";
  if (!key || key === "sk_test_xxxxxxxxxxxxx") {
    throw new Error("CULQI_SECRET_KEY no configurada");
  }
  return key;
}

export async function createCulqiOrder(data: {
  amount: number;
  description: string;
  orderNumber: string;
  baseUrl?: string;
}) {
  // Modo simulado para pruebas sin API key real
  if (isSandboxMode()) {
    const simulatedId = `sim_${Date.now()}`;
    const base = data.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const charge_url = `${base}/api/pagos/sim-payment?orderId=${simulatedId}&amount=${data.amount}`;
    return {
      id: simulatedId,
      url_pe: charge_url,
      qr: null,
      state: "pending",
      amount: Math.round(data.amount * 100),
    };
  }

  if (!isSandboxMode()) {
    const amountInCents = Math.round(data.amount * 100);
    if (amountInCents < 600) {
      throw new Error("El monto mínimo para pago con Yape es S/ 6.00");
    }
  }

  const secretKey = getSecretKey();
  const amountInCents = Math.round(data.amount * 100);

  console.log("Creando orden Culqi:", { amount: amountInCents, descripcion: data.description, orderNumber: data.orderNumber, keyPrefix: secretKey.substring(0, 12) });

  const body = {
    amount: amountInCents,
    currency_code: "PEN",
    description: data.description,
    order_number: data.orderNumber,
    client_details: {
      email: "pos@farmacia.com",
      first_name: "Cliente",
      last_name: "Farmacia",
      phone_number: "999888777",
    },
    expiration_date: Math.floor(Date.now() / 1000) + 3600,
  };

  const res = await fetch(`${CULQI_API_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Error completo Culqi:", JSON.stringify(err, null, 2));
    throw new Error(err.message || err.merchant_message || err.user_message || "Error al crear orden Culqi");
  }

  const dataResponse = await res.json();
  console.log("Respuesta Culqi:", JSON.stringify(dataResponse, null, 2));
  return dataResponse;
}

export async function verifyCulqiCharge(chargeId: string) {
  // Modo simulado: cualquier chargeId que empiece con "sim_" es válido
  if (isSandboxMode() && chargeId.startsWith("sim_")) {
    return { id: chargeId, status: "paid", outcome: { type: "paid" } };
  }

  const secretKey = getSecretKey();

  const res = await fetch(`${CULQI_API_URL}/charges/${chargeId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!res.ok) return null;

  return res.json();
}

export async function getCulqiOrder(orderId: string) {
  // Modo simulado
  if (isSandboxMode() && orderId.startsWith("sim_")) {
    return { id: orderId, state: "paid", amount: 1000 };
  }

  const secretKey = getSecretKey();

  const res = await fetch(`${CULQI_API_URL}/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!res.ok) return null;

  return res.json();
}
