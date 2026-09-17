// server.js
// Punto de entrada del bot. Levanta un servidor web que:
//  1. Responde la verificacion que pide Meta al configurar el webhook (GET).
//  2. Recibe los mensajes de WhatsApp de los operadores (POST) y los
//     guarda en el Google Sheet "Bitacora de Fallas Mecanicas".
//  3. Le contesta al operador confirmando que su reporte se recibio.

require('dotenv').config();
const express = require('express');
const {
  verifySignature,
  extractIncomingMessages,
  downloadMedia,
  sendTextMessage,
} = require('./whatsapp');
const { appendReporte } = require('./sheets');
const { subirArchivo } = require('./drive');

const app = express();

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
};

const TIPO_EN_ESPANOL = {
  text: 'Texto',
  image: 'Foto',
  video: 'Video',
  audio: 'Audio',
  document: 'Documento',
};

// Guardamos el cuerpo crudo de cada peticion (ademas de parsearlo como
// JSON) para poder verificar la firma que manda Meta.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// --- Salud del servicio: util para revisar que el bot esta vivo ---
app.get('/', (_req, res) => {
  res.send('Bot de mantenimiento de Transportes Avila: activo.');
});

// --- Paso 1: Meta verifica el webhook cuando lo configuras ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado correctamente por Meta.');
    res.status(200).send(challenge);
  } else {
    console.warn('Intento de verificacion de webhook con datos incorrectos.');
    res.sendStatus(403);
  }
});

// --- Paso 2: Meta manda aqui cada mensaje nuevo ---
app.post('/webhook', async (req, res) => {
  // Respondemos 200 de inmediato: Meta espera una respuesta rapida y
  // reintenta si tarda mucho o si contestamos con error.
  res.sendStatus(200);

  const signature = req.get('x-hub-signature-256');
  if (!verifySignature(req.rawBody, signature, APP_SECRET)) {
    console.warn('Firma de webhook invalida - se ignora esta peticion.');
    return;
  }

  let mensajes;
  try {
    mensajes = extractIncomingMessages(req.body);
  } catch (err) {
    console.error('No se pudo leer el cuerpo del webhook:', err.message);
    return;
  }

  for (const msg of mensajes) {
    try {
      await procesarMensaje(msg);
    } catch (err) {
      console.error(`Error procesando mensaje de ${msg.from}:`, err.message);
    }
  }
});

async function procesarMensaje(msg) {
  const fecha = msg.timestamp.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
  });
  const hora = msg.timestamp.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
  });

  let textoMensaje = msg.text || msg.caption || '';
  let archivoUrl = null;

  if (msg.mediaId) {
    try {
      const buffer = await downloadMedia(msg.mediaId, WHATSAPP_TOKEN);
      const extension = MIME_EXTENSIONS[msg.mediaMimeType] || 'bin';
      const nombreArchivo = `${msg.from}_${Date.now()}.${extension}`;

      archivoUrl = await subirArchivo({
        buffer,
        nombreArchivo,
        mimeType: msg.mediaMimeType || 'application/octet-stream',
      });
    } catch (err) {
      console.error('No se pudo descargar/subir el archivo adjunto:', err.message);
    }
  }

  await appendReporte({
    fecha,
    hora,
    operador: msg.senderName,
    numero: msg.from,
    tipo: TIPO_EN_ESPANOL[msg.type] || msg.type,
    mensaje: textoMensaje,
    archivoUrl,
  });

  console.log(`Reporte guardado: ${msg.from} (${msg.type}) - "${textoMensaje}"`);

  // Confirmacion breve al operador. Si esto falla no pasa nada grave -
  // el reporte ya quedo guardado en el Sheet de cualquier forma.
  try {
    await sendTextMessage({
      to: msg.from,
      body: '✅ Recibimos tu reporte, gracias. El equipo de mantenimiento lo va a revisar.',
      token: WHATSAPP_TOKEN,
      phoneNumberId: PHONE_NUMBER_ID,
    });
  } catch (err) {
    console.error('No se pudo enviar la confirmacion al operador:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`Bot de mantenimiento escuchando en el puerto ${PORT}`);
});
