// sheets.js
// Escribe cada reporte de falla como un renglon nuevo en el Google Sheet
// "Bitacora de Fallas Mecanicas", usando una cuenta de servicio de Google
// (no tu cuenta personal - por eso hay que compartir el Sheet con el
// correo de la cuenta de servicio).

const { google } = require('googleapis');
const path = require('path');

let sheetsClientPromise = null;

function getSheetsClient() {
  if (!sheetsClientPromise) {
    const keyFile = path.resolve(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './google-service-account.json'
    );

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClientPromise = auth.getClient().then(
      (authClient) => google.sheets({ version: 'v4', auth: authClient })
    );
  }

  return sheetsClientPromise;
}

/**
 * Intenta encontrar un numero de unidad (ECO) dentro del texto del
 * mensaje, por ejemplo "ECO 204", "eco204", "unidad 204", "204". Esto es
 * solo una ayuda automatica - si no encuentra nada, deja la celda vacia
 * para que se llene a mano despues.
 */
function detectarECO(texto) {
  if (!texto) return '';
  const match = texto.match(/(?:eco|unidad)\s*[-#]?\s*(\d{2,4})/i);
  return match ? match[1] : '';
}

/**
 * Agrega una fila nueva al final de la hoja con los datos de un reporte.
 * Columnas (en este orden): Fecha, Hora, Operador, Numero, ECO detectado,
 * Tipo de mensaje, Mensaje / Descripcion, Archivo adjunto (link), Estatus.
 */
async function appendReporte({
  fecha,
  hora,
  operador,
  numero,
  tipo,
  mensaje,
  archivoUrl,
}) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Hoja 1';

  const eco = detectarECO(mensaje);

  const row = [
    fecha,
    hora,
    operador || '(sin nombre)',
    numero,
    eco,
    tipo,
    mensaje || '',
    archivoUrl || '',
    'Nuevo',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = { appendReporte, detectarECO };
