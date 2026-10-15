// Bitácora de fallas en Google Sheets: columnas I:Q desde la fila 5 (lo que lee Geo cada 5 min).
const { google } = require('googleapis');

function fechaMx(d = new Date()) {
  // Formato es-MX como en la hoja actual: "17/9/2026 10:44:56 p.m."
  return d.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour12: true })
    .replace(/[\u202f\u00a0]/g, ' ').replace(',', '').replace(/\s?([ap])\.?\s?m\.?$/i, (m, x) => ' ' + x.toLowerCase() + '.m.');
}
let clienteSheets;
function hojas() {
  if (!clienteSheets) {
    const credenciales = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({ credentials: credenciales, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    clienteSheets = google.sheets({ version: 'v4', auth });
  }
  return clienteSheets;
}
// fila: I=Fecha J=ECO K=Operador L=Teléfono M=Categoría N=Descripción O=Prioridad P=(vacío) Q=Estatus
async function agregarFalla({ eco, operador, telefono, categoria, descripcion, prioridad }) {
  const pestana = process.env.GOOGLE_SHEET_TAB_NAME || 'Untitled';
  const fila = [fechaMx(), eco || '', operador || '', telefono || '', categoria, descripcion, prioridad, '', 'Nuevo'];
  // No se usa "append": Google adivina la tabla y en esta hoja lo escribía corrido a las columnas Q:Y.
  // Se busca la última fila con fecha en la columna I y se escribe exacto en I:Q de la fila siguiente.
  const id = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID; // en Railway se llama GOOGLE_SHEET_ID
  const col = await hojas().spreadsheets.values.get({ spreadsheetId: id, range: `'${pestana}'!I1:I` });
  const usadas = (col.data.values || []).length;
  const n = Math.max(5, usadas + 1);
  await hojas().spreadsheets.values.update({
    spreadsheetId: id,
    range: `'${pestana}'!I${n}:Q${n}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fila] },
  });
}
module.exports = { agregarFalla, fechaMx };
