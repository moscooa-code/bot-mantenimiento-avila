// Cliente de la API de Geo (bd/api_bot.php). Autenticación: encabezado X-Bot-Token.
const configurado = () => !!(process.env.GEO_API_URL && process.env.GEO_BOT_TOKEN);

async function llamar(form) {
  const r = await fetch(process.env.GEO_API_URL, { method: 'POST', headers: { 'X-Bot-Token': process.env.GEO_BOT_TOKEN }, body: form });
  let j = {};
  try { j = await r.json(); } catch (e) { /* respuesta no JSON */ }
  if (!r.ok) throw new Error(j.error || ('Geo respondió ' + r.status));
  return j;
}
async function contexto(telefono) {
  if (!configurado()) return { operador: null, viajes: [], sinGeo: true };
  const f = new FormData(); f.append('accion', 'contexto'); f.append('telefono', telefono);
  return llamar(f);
}
// datos: {categoria, telefono, nombre_whatsapp, id_viaje, folio, eco, texto, litros, monto, firmado_por, media_id, fecha_hora}
async function reporte(datos, media) {
  if (!configurado()) throw new Error('Geo no configurado');
  const f = new FormData(); f.append('accion', 'reporte');
  for (const [k, v] of Object.entries(datos)) if (v !== undefined && v !== null && v !== '') f.append(k, String(v));
  if (media && media.buffer) {
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'video/mp4': 'mp4' })[media.mime] || 'bin';
    f.append('media', new Blob([media.buffer], { type: media.mime }), 'archivo.' + ext);
  }
  return llamar(f);
}
// Avisos de "tienes algo por autorizar" que Geo deja en cola.
async function avisosPendientes() {
  const f = new FormData(); f.append('accion', 'avisos_pendientes');
  const j = await llamar(f);
  return j.avisos || [];
}
async function avisoResultado(id, ok, error) {
  const f = new FormData(); f.append('accion', 'aviso_resultado'); f.append('id', String(id)); f.append('ok', ok ? '1' : '0');
  if (!ok && error) f.append('error', String(error).slice(0, 250));
  return llamar(f);
}
module.exports = { contexto, reporte, configurado, avisosPendientes, avisoResultado };
