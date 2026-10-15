// Cliente mínimo de la WhatsApp Cloud API (Meta).
const GRAPH = () => process.env.GRAPH_BASE || 'https://graph.facebook.com/v20.0';
const headers = () => ({ Authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN, 'Content-Type': 'application/json' });

async function enviar(para, cuerpo) {
  const r = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, ...cuerpo }),
  });
  if (!r.ok) console.error('WhatsApp envío falló', r.status, (await r.text()).slice(0, 300));
  return r.ok;
}
const texto = (para, t) => enviar(para, { type: 'text', text: { body: String(t).slice(0, 4000) } });

// Lista desplegable: máx. 10 filas. filas = [{id, title(≤24), description(≤72)}]
const lista = (para, cuerpo, boton, filas, titulo = 'Opciones') => enviar(para, {
  type: 'interactive',
  interactive: {
    type: 'list', body: { text: cuerpo.slice(0, 1024) },
    action: { button: boton.slice(0, 20), sections: [{ title: titulo.slice(0, 24), rows: filas.slice(0, 10).map(f => ({
      id: f.id, title: f.title.slice(0, 24), ...(f.description ? { description: f.description.slice(0, 72) } : {}) })) }] },
  },
});
// Hasta 3 botones: [{id, title(≤20)}]
const botones = (para, cuerpo, bs) => enviar(para, {
  type: 'interactive',
  interactive: { type: 'button', body: { text: cuerpo.slice(0, 1024) },
    action: { buttons: bs.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } },
});

async function descargarMedia(mediaId) {
  const r1 = await fetch(`${GRAPH()}/${mediaId}`, { headers: { Authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN } });
  if (!r1.ok) throw new Error('No pude consultar el archivo en WhatsApp (' + r1.status + ')');
  const info = await r1.json();
  const r2 = await fetch(info.url, { headers: { Authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN } });
  if (!r2.ok) throw new Error('No pude descargar el archivo de WhatsApp (' + r2.status + ')');
  return { buffer: Buffer.from(await r2.arrayBuffer()), mime: info.mime_type || r2.headers.get('content-type') || 'application/octet-stream' };
}
module.exports = { texto, lista, botones, descargarMedia };
