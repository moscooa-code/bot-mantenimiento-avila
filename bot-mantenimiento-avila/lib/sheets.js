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
  await hojas().spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID, // en Railway se llama GOOGLE_SHEET_ID
    range: `'${pestana}'!I5:Q`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [fila] },
  });
}
module.exports = { agregarFalla, fechaMx };
