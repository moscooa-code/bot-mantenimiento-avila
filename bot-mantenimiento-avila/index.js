// Bot de WhatsApp Transportes Ávila. Node 18+.
const crypto = require('crypto');
const express = require('express');
const wa = require('./lib/whatsapp');
const geo = require('./lib/geo');
const sheets = require('./lib/sheets');
const { crearFlujo } = require('./lib/flujo');

const app = express();
const flujo = crearFlujo({ wa, geo, sheets });
const vistos = new Map(); // deduplicar reintentos de Meta

app.use(express.json({ verify: (req, _res, buf) => { req.raw = buf; } }));

app.get('/', (_q, r) => r.send('Bot Transportes Ávila activo'));
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(req.query['hub.challenge']);
  res.sendStatus(403);
});

function firmaValida(req) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return true; // sin secreto configurado no se valida (no recomendado)
  const h = req.get('x-hub-signature-256') || '';
  const esperada = 'sha256=' + crypto.createHmac('sha256', secreto).update(req.raw || '').digest('hex');
  return h.length === esperada.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(esperada));
}

function normalizar(m) {
  if (m.type === 'text') return { tipo: 'text', texto: m.text.body };
  if (m.type === 'interactive') {
    const i = m.interactive; const r = i.list_reply || i.button_reply;
    return r ? { tipo: i.list_reply ? 'lista' : 'boton', id: r.id, texto: r.title } : null;
  }
  const medio = m.image || m.document || m.video;
  if (medio) return { tipo: 'media', texto: medio.caption || '', media: { id: medio.id, mime: medio.mime_type } };
  return null;
}

app.post('/webhook', async (req, res) => {
  if (!firmaValida(req)) return res.sendStatus(401);
  res.sendStatus(200); // Meta exige responder rápido
  try {
    for (const ent of req.body.entry || []) for (const ch of ent.changes || []) {
      const v = ch.value || {};
      const nombres = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile && c.profile.name]));
      for (const m of v.messages || []) {
        if (vistos.has(m.id)) continue; vistos.set(m.id, Date.now());
        if (vistos.size > 2000) for (const k of [...vistos.keys()].slice(0, 1000)) vistos.delete(k);
        const msg = normalizar(m);
        if (!msg) { await wa.texto(m.from, 'Solo puedo leer texto, fotos y documentos. Escribe "menú" para empezar.'); continue; }
        await flujo.procesar(m.from, nombres[m.from] || '', msg).catch(err => console.error('flujo', err));
      }
    }
  } catch (err) { console.error('webhook', err); }
});

const PUERTO = process.env.PORT || 3000;
if (require.main === module) app.listen(PUERTO, () => console.log('Bot escuchando en', PUERTO));
module.exports = { app, flujo };
