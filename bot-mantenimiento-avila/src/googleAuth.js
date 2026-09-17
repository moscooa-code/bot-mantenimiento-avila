// googleAuth.js
// Crea el cliente de autenticacion de Google que usan sheets.js y drive.js.
//
// Soporta dos formas de darle las credenciales de la cuenta de servicio:
//  1. GOOGLE_SERVICE_ACCOUNT_JSON - el CONTENIDO completo del archivo
//     .json pegado como variable de entorno (asi es como se configura en
//     Railway, ya que ahi no se puede "subir" un archivo).
//  2. GOOGLE_SERVICE_ACCOUNT_KEY_FILE - la ruta a un archivo .json en el
//     servidor (util si corres el bot en tu propia computadora).
//
// Si estan las dos, se usa la variable GOOGLE_SERVICE_ACCOUNT_JSON primero.

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

function cargarCredenciales() {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (jsonEnv) {
    try {
      return JSON.parse(jsonEnv);
    } catch (err) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON valido. Revisa que hayas ' +
          'pegado el contenido completo del archivo .json, sin quitarle ni ' +
          'agregarle nada. Error original: ' + err.message
      );
    }
  }

  const keyFile = path.resolve(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './google-service-account.json'
  );

  if (!fs.existsSync(keyFile)) {
    throw new Error(
      `No se encontraron credenciales de Google. Configura la variable de ` +
        `entorno GOOGLE_SERVICE_ACCOUNT_JSON (recomendado en Railway) o ` +
        `coloca el archivo en: ${keyFile}`
    );
  }

  return JSON.parse(fs.readFileSync(keyFile, 'utf8'));
}

function crearGoogleAuth(scopes) {
  const credentials = cargarCredenciales();
  return new google.auth.GoogleAuth({ credentials, scopes });
}

module.exports = { crearGoogleAuth };
