// /api/create-payment
// Recibe { buyer: {name, email, phone, notes}, design: {...} }
// Crea una preferencia de Mercado Pago y guarda el detalle del diseño
// para que el webhook pueda enviárselo al vendedor cuando se confirme el pago.

let memoryOrders = new Map();

async function getKV() {
  try { const mod = await import('@vercel/kv'); return mod.kv; }
  catch (e) { return null; }
}

async function saveOrder(orderId, data) {
  const kv = await getKV();
  if (kv) { await kv.set(`order:${orderId}`, data, { ex: 60 * 60 * 24 * 30 }); return; }
  memoryOrders.set(orderId, data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { buyer, design } = req.body || {};
  if (!buyer || !design) {
    res.status(400).json({ error: 'Faltan datos' });
    return;
  }
  if (!buyer.email || !buyer.name) {
    res.status(400).json({ error: 'Faltan nombre y email del comprador' });
    return;
  }

  const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_TOKEN) {
    res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    return;
  }

  // Validamos el precio en el server para que no lo manipulen desde el front
  const expectedPrice = validatePrice(design);
  if (expectedPrice == null) {
    res.status(400).json({ error: 'Diseño inválido' });
    return;
  }

  const orderId = 'BUF-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const origin = `https://${req.headers.host}`;

  // Descripción amigable
  const desc = design.fullText || 'Bufanda de mohair personalizada';

  const preference = {
    items: [{
      id: orderId,
      title: 'Bufanda de mohair · ' + orderId,
      description: desc.substring(0, 250),
      quantity: 1,
      currency_id: 'ARS',
      unit_price: expectedPrice,
    }],
    payer: {
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone ? { number: buyer.phone } : undefined,
    },
    back_urls: {
      success: `${origin}/?status=approved&order=${orderId}`,
      pending: `${origin}/?status=pending&order=${orderId}`,
      failure: `${origin}/?status=failure&order=${orderId}`,
    },
    auto_return: 'approved',
    external_reference: orderId,
    notification_url: `${origin}/api/mp-webhook`,
    metadata: { order_id: orderId },
  };

  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MP_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });
    if (!mpRes.ok) {
      const errText = await mpRes.text();
      console.error('MP error:', errText);
      res.status(502).json({ error: 'Mercado Pago rechazó la preferencia' });
      return;
    }
    const mpData = await mpRes.json();

    // Guardar el pedido para que el webhook lo recupere
    await saveOrder(orderId, {
      orderId,
      buyer,
      design,
      price: expectedPrice,
      mpPreferenceId: mpData.id,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    res.status(200).json({
      init_point: mpData.init_point || mpData.sandbox_init_point,
      orderId,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}

// Recalcula el precio en server según la misma lógica que el front
function validatePrice(design) {
  const stripeCount = Array.isArray(design.stripes) ? design.stripes.length : 0;
  const totalColors = 1 + stripeCount;
  const w = Number(design.stripeWidthCm);
  if (!Number.isFinite(w) || w < 7 || w > 40) return null;
  if (totalColors === 1) return 25000;
  const thin = w < 20;
  if (totalColors === 2) return thin ? 30000 : 25000;
  if (totalColors === 3) return thin ? 40000 : 35000;
  const extra = totalColors - 3;
  const base3 = thin ? 40000 : 35000;
  return base3 + extra * (thin ? 10000 : 5000);
}
