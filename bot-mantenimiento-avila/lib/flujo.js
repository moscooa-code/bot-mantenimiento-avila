// Máquina de conversación. Un estado por teléfono, en memoria, que caduca a los 30 min.
const { analizarFalla } = require('./falla');

const TTL_MS = 30 * 60 * 1000;
const CATS = [
  { id: 'acuse_entrega', t: 'Acuse de entrega', d: 'Foto del acuse firmado', viaje: true, foto: true },
  { id: 'combustible', t: 'Combustible', d: 'Ticket de carga de diésel', viaje: true },
  { id: 'carga_salida', t: 'Carga de salida', d: 'Foto de la carga al salir', viaje: true },
  { id: 'llegada_destino', t: 'Llegada a destino', d: 'Ya llegué al cliente/planta', viaje: true },
  { id: 'falla_mecanica', t: 'Falla mecánica', d: 'Reportar falla de la unidad', viaje: false },
  { id: 'incidencia_viaje', t: 'Incidencia en viaje', d: 'Retén, robo, choque, demora', viaje: true },
  { id: 'transito', t: 'Tránsito', d: 'Multa, revisión, bloqueo', viaje: true },
  { id: 'clima', t: 'Clima / camino', d: 'Lluvia, nieve, camino cerrado', viaje: false },
  { id: 'otro', t: 'Otro', d: 'Cualquier otro reporte', viaje: false },
];
const porId = Object.fromEntries(CATS.map(c => [c.id, c]));

function crearFlujo({ wa, geo, sheets, ahora = () => Date.now() }) {
  const estados = new Map();
  const limpiar = () => { const t = ahora(); for (const [k, v] of estados) if (t - v.ts > TTL_MS) estados.delete(k); };
  setInterval(limpiar, 5 * 60 * 1000).unref?.();

  const nuevo = (tel, nombre) => ({ tel, nombre, paso: 'inicio', media: null, texto: '', cat: null, viaje: null, folio: '', ts: ahora() });
  const guardar = e => { e.ts = ahora(); estados.set(e.tel, e); return e; };

  async function menuCategorias(e) {
    e.paso = 'categoria'; guardar(e);
    await wa.lista(e.tel, e.media ? 'Recibí tu archivo. ¿Qué tipo de reporte es?' : '¿Qué quieres reportar?', 'Ver opciones',
      CATS.map(c => ({ id: 'cat:' + c.id, title: c.t, description: c.d })), 'Tipo de reporte');
  }

  async function pedirViaje(e) {
    let ctx = { viajes: [] };
    try { ctx = await geo.contexto(e.tel); } catch (err) { console.error('contexto', err.message); }
    e.operador = ctx.operador || null;
    const viajes = (ctx.viajes || []).slice(0, 8);
    if (!viajes.length) {
      e.paso = 'folio'; guardar(e);
      return wa.texto(e.tel, 'Escribe el folio de tu viaje (por ejemplo V-0123). Si no tienes o no aplica, escribe 0.');
    }
    e.paso = 'viaje'; e.opcionesViaje = viajes; guardar(e);
    const filas = viajes.map(v => ({ id: 'via:' + v.ID_VIAJE, title: v.FOLIO, description: [v.CLIENTE, v.DESTINO].filter(Boolean).join(' → ') || v.ESTATUS }));
    filas.push({ id: 'via:otro', title: 'Otro folio', description: 'Escribir el folio a mano' });
    filas.push({ id: 'via:ninguno', title: 'Sin viaje', description: 'No aplica a un viaje' });
    return wa.lista(e.tel, '¿De qué viaje es?', 'Elegir viaje', filas, 'Tus viajes');
  }

  async function siguienteDato(e) {
    const c = porId[e.cat];
    if (e.cat === 'acuse_entrega') {
      if (!e.media) { e.paso = 'foto'; guardar(e); return wa.texto(e.tel, 'Mándame la foto del acuse firmado (o el PDF).'); }
      if (!e.firmado) { e.paso = 'firmado'; guardar(e); return wa.texto(e.tel, '¿Quién firmó de recibido? Escribe el nombre.'); }
      return terminar(e);
    }
    if (e.cat === 'combustible') {
      if (e.litros === undefined) { e.paso = 'litros'; guardar(e); return wa.texto(e.tel, '¿Cuántos litros cargaste? Solo el número (ej. 350).'); }
      if (e.monto === undefined) { e.paso = 'monto'; guardar(e); return wa.texto(e.tel, '¿Cuál fue el importe total en pesos? Solo el número. Si no lo sabes, escribe 0.'); }
      return terminar(e);
    }
    if (e.cat === 'falla_mecanica') {
      if (!e.texto) { e.paso = 'nota'; guardar(e); return wa.texto(e.tel, 'Escribe el número económico y qué falla tiene. Ejemplo: ECO 45 no frena bien.'); }
      const a = analizarFalla(e.texto);
      if (!a.eco && !e.ecoPreguntado) { e.ecoPreguntado = true; e.paso = 'eco'; guardar(e); return wa.texto(e.tel, '¿Cuál es el número económico de la unidad?'); }
      return terminar(e);
    }
    if (!e.texto && !e.media) { e.paso = 'nota'; guardar(e); return wa.texto(e.tel, 'Escribe una nota corta de lo que pasó.'); }
    if (!e.texto && !e.notaPreguntada) { e.notaPreguntada = true; e.paso = 'nota'; guardar(e); return wa.texto(e.tel, 'Si quieres agregar una nota, escríbela. Si no, escribe "ok".'); }
    return terminar(e);
  }

  async function terminar(e) {
    const c = porId[e.cat];
    const f = e.cat === 'falla_mecanica' ? analizarFalla(e.texto) : null;
    const eco = e.eco || (f && f.eco) || '';
    let media = null;
    if (e.media) {
      try { media = e.media.buffer ? e.media : { ...(await wa.descargarMedia(e.media.id)) }; }
      catch (err) { console.error('media', err.message); }
    }
    let resp = null, errGeo = null;
    try {
      resp = await geo.reporte({
        categoria: e.cat, telefono: e.tel, nombre_whatsapp: e.nombre, id_viaje: e.viaje && e.viaje.id, folio: e.folio || (e.viaje && e.viaje.folio),
        eco, texto: e.texto && e.texto !== 'ok' ? e.texto : '', litros: e.litros, monto: e.monto, firmado_por: e.firmado,
        media_id: e.media && e.media.id, fecha_hora: new Date(ahora()).toISOString(),
      }, media);
    } catch (err) { errGeo = err; console.error('Geo reporte falló:', err.message); }

    if (e.cat === 'falla_mecanica') {
      try {
        await sheets.agregarFalla({ eco, operador: e.nombre, telefono: e.tel, categoria: f.categoria, descripcion: f.descripcion, prioridad: f.prioridad });
      } catch (err) { console.error('Sheets falló:', err.message); if (errGeo) { estados.delete(e.tel); return wa.texto(e.tel, 'No pude registrar tu reporte por un problema técnico. Avisa por teléfono a mantenimiento, por favor.'); } }
    }
    estados.delete(e.tel);
    if (errGeo && e.cat !== 'falla_mecanica') return wa.texto(e.tel, 'No pude guardar tu reporte por un problema técnico. Inténtalo en unos minutos o avisa a tu jefe de tráfico.');
    if (e.cat === 'falla_mecanica') return wa.texto(e.tel, 'Recibimos tu reporte, gracias. El equipo de mantenimiento lo va a revisar.');
    if (e.cat === 'acuse_entrega') return wa.texto(e.tel, resp && resp.aplicado ? `Listo, quedó registrado el acuse del viaje ${resp.folio}. Gracias.` : 'Recibimos tu acuse, gracias. Lo va a revisar el área de operaciones.');
    if (e.cat === 'combustible') return wa.texto(e.tel, 'Recibimos tu carga de combustible, gracias.');
    return wa.texto(e.tel, 'Recibimos tu reporte, gracias.');
  }

  async function elegirCategoria(e, id) {
    const c = porId[id]; if (!c) return menuCategorias(e);
    e.cat = id;
    if (c.viaje) return pedirViaje(e);
    return siguienteDato(e);
  }

  // Entrada única: msg = {tipo:'text'|'media'|'lista'|'boton', texto, media:{id,mime}, id}
  async function procesar(tel, nombre, msg) {
    limpiar();
    let e = estados.get(tel) || nuevo(tel, nombre);
    e.nombre = nombre || e.nombre;
    const txt = (msg.texto || '').trim();

    if (msg.tipo === 'text' && /^(cancelar|cancela|salir)$/i.test(txt)) { estados.delete(tel); return wa.texto(tel, 'Listo, cancelé el reporte. Cuando necesites, mándame una foto o escribe "menú".'); }

    if (msg.tipo === 'media') {
      // Un archivo nuevo siempre empieza un reporte nuevo, salvo que esté esperando justo la foto del acuse.
      if (e.paso === 'foto') { e.media = msg.media; if (txt) e.texto = txt; return siguienteDato(e); }
      e = nuevo(tel, nombre); e.media = msg.media; if (txt) e.texto = txt;
      return menuCategorias(e);
    }
    if (msg.tipo === 'lista' || msg.tipo === 'boton') {
      if (msg.id.startsWith('cat:')) return elegirCategoria(e, msg.id.slice(4));
      if (msg.id.startsWith('via:') && e.paso === 'viaje') {
        const v = msg.id.slice(4);
        if (v === 'otro') { e.paso = 'folio'; guardar(e); return wa.texto(tel, 'Escribe el folio del viaje (por ejemplo V-0123).'); }
        if (v !== 'ninguno') { const sel = (e.opcionesViaje || []).find(x => String(x.ID_VIAJE) === v); if (sel) e.viaje = { id: sel.ID_VIAJE, folio: sel.FOLIO }; }
        return siguienteDato(e);
      }
      return menuCategorias(e);
    }

    // Texto
    switch (e.paso) {
      case 'folio': e.folio = txt === '0' ? '' : txt.toUpperCase().replace(/\s+/g, ''); return siguienteDato(e);
      case 'firmado': e.firmado = txt.slice(0, 150); return siguienteDato(e);
      case 'litros': case 'monto': {
        const n = parseFloat(txt.replace(/[^0-9.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
        if (!isFinite(n)) return wa.texto(tel, 'Solo necesito el número, por ejemplo 350.');
        e[e.paso] = n; return siguienteDato(e);
      }
      case 'eco': e.eco = txt.replace(/^(eco|econ[oó]mico)\s*/i, '').toUpperCase().slice(0, 20); return siguienteDato(e);
      case 'nota': e.texto = txt; return siguienteDato(e);
      case 'foto': return wa.texto(tel, 'Necesito la foto del acuse. Mándala como imagen, o escribe "cancelar".');
      case 'categoria': case 'viaje': return wa.texto(tel, 'Elige una opción de la lista, por favor. Si te equivocaste, escribe "cancelar".');
    }
    // Sin conversación abierta
    if (/^(men[uú]|hola|reporte|ayuda|buenas.*|buen[oa]s)$/i.test(txt)) return menuCategorias(nuevo(tel, nombre));
    if (/^(ok|okey|gracias|muchas gracias|listo|va|s[ií]|👍|enterado)[.! ]*$/i.test(txt)) return wa.texto(tel, 'Con gusto. Si necesitas reportar algo, manda una foto o escribe "menú".');
    // Texto suelto = falla mecánica, igual que el bot original.
    e = nuevo(tel, nombre); e.cat = 'falla_mecanica'; e.texto = txt;
    return siguienteDato(e);
  }
  return { procesar, _estados: estados };
}
module.exports = { crearFlujo, CATS };
