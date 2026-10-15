// Lectura de un mensaje de falla escrito en texto libre (mismo criterio que el bot original).
const CATEGORIAS = [
  ['Motor', /motor|aceite|turbo|sobrecalent|humo|arranc|diesel|combustible.*fuga/i],
  ['Eléctrico', /el[eé]ctric|bater[ií]a|luces?|faros?|alternador|marcha|fusible|cable/i],
  ['Llantas/Neumáticos', /llanta|neum[aá]tic|ponch|reventó|revent[oó]|aire.*llanta|rin/i],
  ['Suspensión', /suspensi[oó]n|amortiguador|muelle|balata.*suspen|bolsa de aire|ballesta/i],
  ['Refrigeración', /refrigera|radiador|anticongelante|temperatura|clima|termo|reefer/i],
  ['Frenos', /freno|balata|zapata|tambor|no frena|frenad/i],
];
const URGENTE = /urgente|no arranca|no prende|varado|accidente|choque|incendio|sin frenos|no frena|humo|reventó|revent[oó]|no avanza|cr[ií]tic/i;

function extraerEco(texto) {
  const t = String(texto || '');
  let m = t.match(/\b(?:eco(?:n[oó]mico)?|unidad|camion|cami[oó]n|tracto)\s*[:#.\-]?\s*([A-Za-z]{0,3}\s?-?\d{1,5}[A-Za-z]?)\b/i);
  if (m) return m[1].replace(/\s+/g, '').toUpperCase();
  m = t.match(/\b(?:#|no\.?\s*)(\d{1,5})\b/i);
  return m ? m[1] : '';
}
function categoriaFalla(texto) {
  for (const [nombre, re] of CATEGORIAS) if (re.test(texto)) return nombre;
  return 'Sin especificar';
}
function prioridadFalla(texto) { return URGENTE.test(texto) ? 'Alta' : 'Por revisar'; }

function analizarFalla(texto) {
  return { eco: extraerEco(texto), categoria: categoriaFalla(texto), prioridad: prioridadFalla(texto), descripcion: String(texto || '').trim() };
}
module.exports = { analizarFalla, extraerEco, categoriaFalla, prioridadFalla };
