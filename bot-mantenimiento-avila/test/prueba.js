// Pruebas con simuladores: Graph API falsa + Geo falso + hoja falsa. No toca nada real.
const http = require('http'); const crypto = require('crypto'); const assert = require('assert');
const enviados = [], geoLlamadas = [], filasHoja = [];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const graph = http.createServer((req, res) => {
  const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => {
    if (req.method === 'POST' && req.url.endsWith('/messages')) { enviados.push(JSON.parse(Buffer.concat(chunks))); return res.end('{}'); }
    if (req.url.startsWith('/MEDIA1')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ url: `http://127.0.0.1:${graph.address().port}/bin/1`, mime_type: 'image/png' })); }
    if (req.url === '/bin/1') { res.setHeader('content-type', 'image/png'); return res.end(PNG); }
    res.statusCode = 404; res.end();
  });
});
const geoSrv = http.createServer((req, res) => {
  const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => {
    if (req.headers['x-bot-token'] !== 'TOK') { res.statusCode = 401; return res.end('{"error":"No autorizado"}'); }
    const cuerpo = Buffer.concat(chunks).toString('utf8');
    const campo = k => (cuerpo.match(new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
    if (campo('accion') === 'contexto') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(campo('telefono') === '5215500000001' ? { operador: { id: 7, nombre: 'Prueba' }, viajes: [{ ID_VIAJE: 55, FOLIO: 'V-0055', ESTATUS: 'en_curso', DESTINO: 'Toluca', CLIENTE: 'ACME' }] } : { operador: null, viajes: [] }));
    }
    geoLlamadas.push({ campos: Object.fromEntries(['categoria', 'id_viaje', 'folio', 'eco', 'texto', 'litros', 'monto', 'firmado_por', 'media_id'].map(k => [k, campo(k)])), conArchivo: cuerpo.includes('name="media"') });
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, aplicado: campo('categoria') === 'acuse_entrega', folio: campo('folio') }));
  });
});

const sheetsFalso = { agregarFalla: async f => { filasHoja.push(f); }, fechaMx: () => '' };
async function main() {
  await new Promise(r => graph.listen(0, r)); await new Promise(r => geoSrv.listen(0, r));
  Object.assign(process.env, { GRAPH_BASE: `http://127.0.0.1:${graph.address().port}`, WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '123',
    WHATSAPP_VERIFY_TOKEN: 'verif', WHATSAPP_APP_SECRET: 'sec', GEO_API_URL: `http://127.0.0.1:${geoSrv.address().port}/api`, GEO_BOT_TOKEN: 'TOK' });
  require.cache[require.resolve('../lib/sheets')] = { id: 'x', filename: 'x', loaded: true, exports: sheetsFalso };
  const { app } = require('../index');
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;

  let n = 0;
  const enviar = async (from, m, nombre = 'Operador Uno', firmar = true) => {
    const body = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name: nombre } }], messages: [{ from, id: 'm' + (++n), ...m }] } }] }] });
    const sig = 'sha256=' + crypto.createHmac('sha256', 'sec').update(body).digest('hex');
    const r = await fetch(base + '/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': firmar ? sig : 'sha256=mal' }, body });
    await new Promise(r => setTimeout(r, 120)); return r.status;
  };
  const texto = t => ({ type: 'text', text: { body: t } });
  const lista = id => ({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id, title: id } } });
  const ultimo = () => enviados[enviados.length - 1];
  const ultimoTexto = () => (ultimo().text || {}).body || (ultimo().interactive || {}).body?.text;

  // 0. Verificación del webhook y firma
  assert.equal((await fetch(base + '/webhook?hub.mode=subscribe&hub.verify_token=verif&hub.challenge=abc')).status, 200);
  assert.equal((await fetch(base + '/webhook?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=abc')).status, 403);
  assert.equal(await enviar('5215500000001', texto('hola'), 'X', false), 401); assert.equal(enviados.length, 0);

  // 1. Texto suelto = falla, igual que el bot actual
  await enviar('5215599999999', texto('ECO 45 no frena bien, urgente'));
  assert.equal(filasHoja.length, 1); assert.equal(filasHoja[0].eco, '45'); assert.equal(filasHoja[0].categoria, 'Frenos'); assert.equal(filasHoja[0].prioridad, 'Alta');
  assert.match(ultimoTexto(), /Recibimos tu reporte/); assert.equal(geoLlamadas.at(-1).campos.categoria, 'falla_mecanica');

  // 2. Acuse con foto, operador conocido: foto → categoría → viaje → firmó → listo
  await enviar('5215500000001', { type: 'image', image: { id: 'MEDIA1', mime_type: 'image/png' } });
  assert.equal(ultimo().interactive.type, 'list'); assert.equal(ultimo().interactive.action.sections[0].rows.length, 9);
  await enviar('5215500000001', lista('cat:acuse_entrega'));
  const filas = ultimo().interactive.action.sections[0].rows; assert.equal(filas[0].title, 'V-0055'); assert.ok(filas.length <= 10);
  await enviar('5215500000001', lista('via:55'));
  assert.match(ultimoTexto(), /firmó/);
  await enviar('5215500000001', texto('Juan Pérez'));
  const g = geoLlamadas.at(-1); assert.equal(g.campos.categoria, 'acuse_entrega'); assert.equal(g.campos.id_viaje, '55'); assert.equal(g.campos.firmado_por, 'Juan Pérez'); assert.equal(g.campos.media_id, 'MEDIA1'); assert.ok(g.conArchivo);
  assert.match(ultimoTexto(), /V-0055/);

  // 3. Combustible por operador desconocido: pide folio a mano, litros y monto
  await enviar('5215588888888', { type: 'image', image: { id: 'MEDIA1', mime_type: 'image/png', caption: 'ticket' } });
  await enviar('5215588888888', lista('cat:combustible'));
  assert.match(ultimoTexto(), /folio/);
  await enviar('5215588888888', texto('v-0099'));
  await enviar('5215588888888', texto('abc')); // no válido aún (estamos en litros)
  assert.match(ultimoTexto(), /número/);
  await enviar('5215588888888', texto('350.5'));
  await enviar('5215588888888', texto('$7,420'));
  const c = geoLlamadas.at(-1).campos; assert.equal(c.categoria, 'combustible'); assert.equal(c.folio, 'V-0099'); assert.equal(c.litros, '350.5'); assert.equal(c.monto, '7420');

  // 4. Falla con foto y sin ECO: pregunta ECO, escribe a hoja y a Geo con archivo
  await enviar('5215577777777', { type: 'image', image: { id: 'MEDIA1', mime_type: 'image/png' } });
  await enviar('5215577777777', lista('cat:falla_mecanica'));
  await enviar('5215577777777', texto('se ponchó una llanta'));
  assert.match(ultimoTexto(), /económico/);
  await enviar('5215577777777', texto('ECO 12'));
  assert.equal(filasHoja.at(-1).eco, 'ECO 12'.toUpperCase().replace(/^ECO\s*/, '')); assert.equal(filasHoja.at(-1).categoria, 'Llantas/Neumáticos'); assert.ok(geoLlamadas.at(-1).conArchivo);

  // 5. Cancelar y menú sin foto
  await enviar('5215566666666', texto('menú')); assert.equal(ultimo().interactive.type, 'list');
  await enviar('5215566666666', lista('cat:clima')); await enviar('5215566666666', texto('cancelar')); assert.match(ultimoTexto(), /cancel/);
  await enviar('5215566666666', lista('cat:otro')); await enviar('5215566666666', texto('Se me cayó un espejo')); assert.equal(geoLlamadas.at(-1).campos.categoria, 'otro');
  await enviar('5215566666666', texto('gracias')); assert.match(ultimoTexto(), /Con gusto/);

  // 6. Geo caído: el operador recibe aviso claro, no silencio
  process.env.GEO_BOT_TOKEN = 'MALO';
  await enviar('5215555555555', texto('menú')); await enviar('5215555555555', lista('cat:otro')); await enviar('5215555555555', texto('prueba'));
  assert.match(ultimoTexto(), /problema técnico/);
  console.log('TODAS LAS PRUEBAS PASARON (' + enviados.length + ' mensajes simulados)'); process.exit(0);
}
main().catch(e => { console.error('FALLÓ:', e); process.exit(1); });
