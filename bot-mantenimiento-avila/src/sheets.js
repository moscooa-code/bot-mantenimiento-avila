// sheets.js
// Escribe cada reporte de falla como un renglon nuevo en el Google Sheet
// "Bitacora de Fallas Mecanicas", usando una cuenta de servicio de Google
// (no tu cuenta personal - por eso hay que compartir el Sheet con el
// correo de la cuenta de servicio).

const { google } = require('googleapis');
const { crearGoogleAuth } = require('./googleAuth');

let sheetsClientPromise = null;

function getSheetsClient() {
  if (!sheetsClientPromise) {
    const auth = crearGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);

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

// Palabras clave para adivinar la categoria de la falla a partir del
// texto que manda el operador. Es solo una ayuda automatica - el taller
// puede corregirla despues directamente en el Sheet.
const CATEGORIAS = [
  { nombre: 'Frenos', palabras: ['freno', 'frenos', 'frenar'] },
  { nombre: 'Motor', palabras: ['motor', 'no arranca', 'no prende', 'humo'] },
  { nombre: 'Eléctrico', palabras: ['electric', 'eléctric', 'luz', 'luces', 'bateria', 'batería', 'fusible'] },
  { nombre: 'Llantas/Neumáticos', palabras: ['llanta', 'neumatico', 'neumático', 'ponchadura', 'rin'] },
  { nombre: 'Suspensión', palabras: ['suspension', 'suspensión', 'amortiguador', 'muelle'] },
  { nombre: 'Transmisión', palabras: ['transmision', 'transmisión', 'clutch', 'embrague', 'caja'] },
  { nombre: 'Refrigeración', palabras: ['radiador', 'refrigeracion', 'refrigeración', 'anticongelante', 'calenta'] },
  { nombre: 'Carrocería', palabras: ['carroceria', 'carrocería', 'golpe', 'choque', 'espejo', 'vidrio'] },
];

function detectarCategoria(texto) {
  if (!texto) return 'Sin especificar';
  const textoNormalizado = texto.toLowerCase();
  for (const categoria of CATEGORIAS) {
    if (categoria.palabras.some((palabra) => textoNormalizado.includes(palabra))) {
      return categoria.nombre;
    }
  }
  return 'Sin especificar';
}

// Palabras que sugieren que la falla es urgente (unidad parada / peligro).
const PALABRAS_URGENTES = [
  'urgente', 'urgencia', 'parado', 'parada', 'no arranca', 'no prende',
  'no jala', 'accidente', 'choque', 'fuego', 'humo', 'peligro',
];

function detectarUrgencia(texto) {
  if (!texto) return 'Por revisar';
  const textoNormalizado = texto.toLowerCase();
  const esUrgente = PALABRAS_URGENTES.some((palabra) => textoNormalizado.includes(palabra));
  return esUrgente ? 'Alta' : 'Por revisar';
}

/**
 * Agrega una fila nueva al final de la hoja con los datos de un reporte.
 * Columnas (en este orden, igual que en el Sheet real "Bitacora de Fallas
 * Mecanicas"): Fecha/Hora reporte, Unidad (ECO), Operador, Telefono,
 * Categoria, Descripcion de la falla, Urgencia, Evidencia (foto/video),
 * Estatus, Fecha resolucion, Notas de taller.
 */
async function appendReporte({
  fecha,
  hora,
  operador,
  numero,
  mensaje,
  archivoUrl,
}) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Hoja 1';

  const eco = detectarECO(mensaje);
  const categoria = detectarCategoria(mensaje);
  const urgencia = detectarUrgencia(mensaje);

  const row = [
    `${fecha} ${hora}`.trim(),   // Fecha/Hora reporte
    eco,                          // Unidad (ECO)
    operador || '(sin nombre)',   // Operador
    numero,                       // Telefono
    categoria,                    // Categoria
    mensaje || '',                // Descripcion de la falla
    urgencia,                     // Urgencia
    archivoUrl || '',             // Evidencia (foto/video)
    'Nuevo',                      // Estatus
    '',                           // Fecha resolucion (la llena el taller)
    '',                           // Notas de taller (la llena el taller)
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:K`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = { appendReporte, detectarECO, detectarCategoria, detectarUrgencia };
