// drive.js
// Sube fotos/videos/audios que manden los operadores a una carpeta de
// Google Drive, y regresa el link para verlos - ese link es el que se
// guarda en la columna "Archivo adjunto" del Google Sheet.

const { google } = require('googleapis');
const path = require('path');
const { Readable } = require('stream');

let driveClientPromise = null;

function getDriveClient() {
  if (!driveClientPromise) {
    const keyFile = path.resolve(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './google-service-account.json'
    );

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    driveClientPromise = auth.getClient().then(
      (authClient) => google.drive({ version: 'v3', auth: authClient })
    );
  }

  return driveClientPromise;
}

/**
 * Sube un archivo (buffer en memoria) a la carpeta de Drive configurada
 * en GOOGLE_DRIVE_FOLDER_ID, lo deja visible para cualquiera que tenga el
 * link (solo lectura), y regresa esa URL.
 *
 * Si no hay GOOGLE_DRIVE_FOLDER_ID configurado, esta funcion no hace nada
 * y regresa null - el bot sigue funcionando, solo que sin guardar el
 * archivo adjunto.
 */
async function subirArchivo({ buffer, nombreArchivo, mimeType }) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return null;

  const drive = await getDriveClient();

  const createResponse = await drive.files.create({
    requestBody: {
      name: nombreArchivo,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
  });

  const fileId = createResponse.data.id;

  // Lo dejamos visible para cualquiera con el link (solo lectura) para
  // que se pueda abrir directo desde el Google Sheet sin pedir permiso.
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return `https://drive.google.com/file/d/${fileId}/view`;
}

module.exports = { subirArchivo };
