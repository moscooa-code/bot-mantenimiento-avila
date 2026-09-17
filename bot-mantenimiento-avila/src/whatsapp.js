// whatsapp.js
// Funciones para hablar con la API de WhatsApp Cloud (Meta):
// - Extraer los datos utiles de un mensaje entrante (webhook).
// - Descargar archivos multimedia (fotos/videos/audios) que mande un operador.
// - Mandar un mensaje de confirmacion de vuelta al operador.
// - Verificar que un webhook realmente viene de Meta (firma).

const axios = require('axios');
const crypto = require('crypto');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Revisa el cuerpo crudo de una peticion contra la firma que manda Meta
 * en el header "x-hub-signature-256", usando el App Secret de tu app.
 * Si no configuraste WHATSAPP_APP_SECRET, esta funcion no bloquea nada
 * (regresa true), pero se recomienda configurarlo en produccion.
 */
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return true; // sin app secret configurado, no se valida
  if (!signatureHeader) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false; // longitudes distintas u otro problema de formato
  }
}

/**
 * Toma el JSON completo que manda Meta a POST /webhook y lo convierte
 * en una lista simple de mensajes entrantes, con solo lo que nos importa.
 * Un solo webhook puede traer 0, 1 o varios mensajes.
 */
function extractIncomingMessages(body) {
  const messages = [];

  const entries = body?.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const contacts = value.contacts || [];
      const rawMessages = value.messages || [];

      for (const msg of rawMessages) {
        const contact = contacts.find((c) => c.wa_id === msg.from);
        const senderName = contact?.profile?.name || null;

        messages.push({
          id: msg.id,
          from: msg.from, // numero de whatsapp del operador (sin '+')
          senderName,
          timestamp: msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000)
            : new Date(),
          type: msg.type, // 'text' | 'image' | 'video' | 'audio' | 'document' | ...
          text: msg.text?.body || null,
          caption:
            msg.image?.caption || msg.video?.caption || msg.document?.caption || null,
          mediaId:
            msg.image?.id || msg.video?.id || msg.audio?.id || msg.document?.id || null,
          mediaMimeType:
            msg.image?.mime_type ||
            msg.video?.mime_type ||
            msg.audio?.mime_type ||
            msg.document?.mime_type ||
            null,
        });
      }
    }
  }

  return messages;
}

/**
 * Descarga un archivo multimedia de WhatsApp (foto, video, audio, etc.)
 * dado su mediaId. WhatsApp funciona en dos pasos: primero pides la URL
 * temporal del archivo, luego descargas el archivo de esa URL con tu token.
 * Regresa un Buffer con el contenido del archivo.
 */
async function downloadMedia(mediaId, token) {
  const metaResponse = await axios.get(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const mediaUrl = metaResponse.data.url;

  const fileResponse = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
  });

  return Buffer.from(fileResponse.data);
}

/**
 * Manda un mensaje de texto normal de vuelta a un numero (por ejemplo,
 * para confirmarle al operador que su reporte se recibio). Esto solo
 * funciona dentro de las 24 horas despues de que esa persona te escribio
 * (no requiere plantilla aprobada porque es una respuesta, no un mensaje
 * iniciado por el negocio).
 */
async function sendTextMessage({ to, body, token, phoneNumberId }) {
  await axios.post(
    `${GRAPH_BASE}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

module.exports = {
  verifySignature,
  extractIncomingMessages,
  downloadMedia,
  sendTextMessage,
};
