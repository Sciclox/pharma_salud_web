import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") || "sim_unknown";
  const amount = searchParams.get("amount") || "0.00";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pago Yape - Simulación</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f3ff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 20px; padding: 32px; max-width: 380px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,.08); text-align: center; }
  .badge { background: #fef3c7; color: #92400e; font-size: .75rem; font-weight: 600; padding: 4px 12px; border-radius: 999px; display: inline-block; margin-bottom: 16px; }
  .amount { font-size: 2.5rem; font-weight: 800; color: #111827; margin: 8px 0 4px; }
  .label { font-size: .85rem; color: #6b7280; }
  .order-id { font-size: .75rem; color: #9ca3af; margin: 16px 0 24px; word-break: break-all; background: #f9fafb; padding: 8px 12px; border-radius: 8px; }
  .btn { display: inline-flex; align-items: center; gap: 8px; background: #7c3aed; color: #fff; border: none; padding: 14px 32px; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background .2s; }
  .btn:hover { background: #6d28d9; }
  .btn:disabled { background: #c4b5fd; cursor: not-allowed; }
  .sim-badge { background: #dcfce7; color: #166534; font-size: .7rem; font-weight: 600; padding: 6px 12px; border-radius: 6px; margin-bottom: 20px; display: inline-block; }
  .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .success-icon { width: 64px; height: 64px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 2rem; color: #059669; }
</style>
</head>
<body>
<div class="card">
  <div class="sim-badge">🛠️ MODO SIMULACIÓN</div>
  <div class="badge">Yape</div>
  <div class="label">Total a pagar</div>
  <div class="amount">S/ ${amount}</div>
  <div class="order-id">${orderId}</div>
  <div id="status-area">
    <button class="btn" id="payBtn" onclick="simularPago()">
      <span id="btnText">Pagar con Yape</span>
    </button>
  </div>
  <p style="margin-top: 20px; font-size: .75rem; color: #9ca3af;">Esta es una simulación — el pago no es real</p>
</div>
<script>
let loading = false;
async function simularPago() {
  if (loading) return;
  loading = true;
  const btn = document.getElementById('payBtn');
  const btnText = document.getElementById('btnText');
  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner"></span> Procesando…';

  // Notificar al servidor que el pago fue simulado (webhook simulado)
  try {
    await fetch('/api/pagos/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { id: '${orderId}' },
        object: 'charge',
        type: 'charge.completed',
      }),
    });
  } catch (e) {}

  setTimeout(() => {
    document.getElementById('status-area').innerHTML = \`
      <div class="success-icon">✓</div>
      <h2 style="color: #059669; margin-bottom: 8px;">¡Pago exitoso!</h2>
      <p style="color: #6b7280; font-size: .9rem; margin-bottom: 20px;">El pago se ha procesado correctamente.</p>
      <p style="color: #9ca3af; font-size: .8rem;">Ya puedes cerrar esta ventana.</p>
    \`;
    btn.remove();
  }, 2000);
}
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
