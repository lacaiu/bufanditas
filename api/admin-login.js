// /api/admin-login
// Recibe { password } y devuelve un token si coincide con ADMIN_PASSWORD.
import { sign } from './_jwt.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD no configurado' });
    return;
  }
  if (password !== expected) {
    res.status(401).json({ error: 'Clave incorrecta' });
    return;
  }
  // Token simple firmado con el secreto del entorno
  const token = sign({ role: 'admin', iat: Date.now() }, process.env.ADMIN_PASSWORD);
  res.status(200).json({ token });
}
