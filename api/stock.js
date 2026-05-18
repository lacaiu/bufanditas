// /api/stock
// GET → devuelve { outOfStock: [...] }
// POST → guarda { outOfStock: [...] } (requiere token admin)
//
// Usa Vercel KV (Redis) para persistir. Si no hay KV configurado,
// usa /tmp como fallback (se pierde con cada deploy, pero sirve para probar).
import { verify } from './_jwt.js';

const KEY = 'bufandita:outOfStock';
let memoryStore = null;

async function getKV() {
  try {
    const mod = await import('@vercel/kv');
    return mod.kv;
  } catch (e) {
    return null;
  }
}

async function readStock() {
  const kv = await getKV();
  if (kv) {
    const data = await kv.get(KEY);
    return Array.isArray(data) ? data : [];
  }
  return memoryStore || [];
}

async function writeStock(arr) {
  const kv = await getKV();
  if (kv) { await kv.set(KEY, arr); return; }
  memoryStore = arr;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const outOfStock = await readStock();
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ outOfStock });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const token = req.headers['x-admin-token'];
    const verified = verify(token, process.env.ADMIN_PASSWORD || '');
    if (!verified || verified.role !== 'admin') {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    const { outOfStock } = req.body || {};
    if (!Array.isArray(outOfStock)) {
      res.status(400).json({ error: 'outOfStock debe ser un array' });
      return;
    }
    try {
      await writeStock(outOfStock);
      res.status(200).json({ ok: true, count: outOfStock.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
