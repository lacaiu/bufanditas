// /api/mp-webhook
// Mercado Pago llama acá cuando un pago cambia de estado.
// Buscamos el detalle del pedido y te mandamos un email con todo.

let memoryOrders = new Map(); // mismo fallback que create-payment.js

async function getKV() {
  try { const mod = await import('@vercel/kv'); return mod.kv; }
  catch (e) { return null; }
}

async function loadOrder(orderId) {
  const kv = await getKV();
  if (kv) return await kv.get(`order:${orderId}`);
  return memoryOrders.get(orderId);
}

async function saveOrder(orderId, data) {
  const kv = await getKV();
  if (kv) { await kv.set(`order:${orderId}`, data, { ex: 60 * 60 * 24 * 30 }); return; }
  memoryOrders.set(orderId, data);
}

export default async function handler(req, res) {
  // MP envía notificaciones en distintos formatos (legacy / v1)
  const topic = req.query.topic || req.query.type || (req.body && req.body.type);
  const id = req.query.id || (req.body && req.body.data && req.body.data.id);

  if (topic !== 'payment' || !id) {
    res.status(200).send('ok'); // ignorar otros tipos
    return;
  }

  const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_TOKEN) { res.status(500).send('no token'); return; }

  try {
    // Consultar el pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': 'Bearer ' + MP_TOKEN },
    });
    if (!mpRes.ok) { res.status(200).send('payment not found'); return; }
    const payment = await mpRes.json();

    const orderId = payment.external_reference;
    if (!orderId) { res.status(200).send('no ref'); return; }

    const order = await loadOrder(orderId);
    if (!order) { res.status(200).send('order not in storage'); return; }

    // Actualizar estado
    order.status = payment.status;
    order.paymentId = payment.id;
    order.paidAmount = payment.transaction_amount;
    order.paidAt = payment.date_approved || new Date().toISOString();
    await saveOrder(orderId, order);

    // Si está aprobado, mandar email al vendedor
    if (payment.status === 'approved' && !order.notified) {
      await notifySeller(order, payment);
      order.notified = true;
      await saveOrder(orderId, order);
    }

    res.status(200).send('ok');
  } catch (e) {
    console.error(e);
    res.status(200).send('handled'); // siempre 200 para que MP no reintente para siempre
  }
}

async function notifySeller(order, payment) {
  const SELLER_EMAIL = process.env.SELLER_EMAIL;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!SELLER_EMAIL || !RESEND_KEY) {
    console.log('Email no configurado, pedido:', order.orderId, order.design.summaryText);
    return;
  }

  const d = order.design;
  const buyer = order.buyer;

  const stripeRows = (d.stripes || []).map((s, i) => `
    <tr>
      <td style="padding: 4px 8px; background: ${s.hex}; color: ${pickTextColor(s.hex)}; border-radius: 4px;">Franja ${i + 1}</td>
      <td style="padding: 4px 8px;">${s.code ? s.code + ' ' : ''}${s.name}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #2A2722; font-size: 22px; margin: 0 0 8px;">🎉 Nueva venta de bufandita</h1>
      <p style="color: #7A746C; font-size: 14px;">Pedido <strong>${order.orderId}</strong></p>

      <h2 style="font-size: 16px; margin-top: 24px; color: #2A2722;">Diseño</h2>
      <table style="border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 4px 8px; background: ${d.base.hex}; color: ${pickTextColor(d.base.hex)}; border-radius: 4px;">Base</td>
          <td style="padding: 4px 8px;">${d.base.code ? d.base.code + ' ' : ''}${d.base.name}</td>
        </tr>
        ${stripeRows}
      </table>
      <p style="font-size: 14px; color: #5A544D; margin-top: 12px;">
        Grosor: <strong>${d.stripeWidthCm} cm</strong><br/>
        Variación: <strong>${d.variation}%</strong><br/>
        Largo total: 2 m
      </p>

      <h2 style="font-size: 16px; margin-top: 24px; color: #2A2722;">Cliente</h2>
      <p style="font-size: 14px; color: #5A544D;">
        <strong>${buyer.name}</strong><br/>
        ${buyer.email}<br/>
        ${buyer.phone ? buyer.phone + '<br/>' : ''}
        ${buyer.notes ? '<em>' + escapeHtml(buyer.notes) + '</em>' : ''}
      </p>

      <h2 style="font-size: 16px; margin-top: 24px; color: #2A2722;">Pago</h2>
      <p style="font-size: 14px; color: #5A544D;">
        <strong>$${(payment.transaction_amount || 0).toLocaleString('es-AR')}</strong><br/>
        ${payment.payment_method_id || ''} · ID ${payment.id}<br/>
        <a href="https://www.mercadopago.com.ar/activities/detail/${payment.id}" target="_blank">Ver comprobante en Mercado Pago →</a>
      </p>
    </div>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'Bufanditas <onboarding@resend.dev>',
      to: SELLER_EMAIL,
      reply_to: buyer.email,
      subject: `🧣 Nueva venta · ${order.orderId} · $${(payment.transaction_amount || 0).toLocaleString('es-AR')}`,
      html,
    }),
  });
}

function pickTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#000' : '#FFF';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
