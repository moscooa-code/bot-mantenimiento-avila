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

// Cada minuto: avisos de autorizaciones pendientes que Geo dejó en cola.
// Plantilla de Meta (variables: {{1}} nombre, {{2}} qué, {{3}} cuánto, {{4}} quién lo pide, {{5}} referencia).
let enviandoAvisos = false;
async function mandarAvisos() {
  if (enviandoAvisos || !geo.configurado()) return;
  enviandoAvisos = true;
  try {
    const avisos = await geo.avisosPendientes();
    for (const a of avisos) {
      const params = [a.NOMBRE, a.QUE, a.CUANTO, a.PIDE, a.REF];
      let ok = await wa.plantilla(a.TELEFONO, process.env.AVISO_PLANTILLA || 'aviso_autorizacion', process.env.AVISO_IDIOMA || 'es_MX', params);
      let error = ok ? null : wa.ultimoError();
      if (!ok) { // Respaldo: texto normal (solo llega si esa persona le escribió al bot en las últimas 24 h)
        ok = await wa.texto(a.TELEFONO, `Hola ${a.NOMBRE}, tienes por autorizar en Geo: ${a.QUE} por ${a.CUANTO}, lo pide ${a.PIDE} (${a.REF}). Ábrelo aquí: https://geo.transportesavila.mx/autorizaciones.php`);
      }
      await geo.avisoResultado(a.ID_AVISO, ok, error).catch(e => console.error('aviso resultado', e.message));
    }
  } catch (e) { console.error('avisos', e.message); }
  finally { enviandoAvisos = false; }
}

const PUERTO = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PUERTO, () => console.log('Bot escuchando en', PUERTO));
  setInterval(mandarAvisos, 60 * 1000);
}
module.exports = { app, flujo, mandarAvisos };
