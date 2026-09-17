# Bot de Mantenimiento - Transportes Ávila

Este proyecto recibe los mensajes que tus operadores mandan por WhatsApp al
número de negocio (+52 1 56 5475 5062) y los guarda automáticamente como un
renglón nuevo en tu Google Sheet **"Bitácora de Fallas Mecánicas"**. Si el
operador manda una foto o video, también se sube a Google Drive y se deja
el link en el Sheet. Al operador se le contesta un mensaje corto de
confirmación ("Recibimos tu reporte...").

Ya viene probado y funcionando (se hicieron pruebas locales del código).
Lo que falta es: (1) crear la cuenta de servicio de Google, (2) subir este
proyecto a un servicio de hosting, y (3) conectar todo en Meta. Esta guía
cubre los tres pasos, en orden.

---

## Paso 1: Crear la cuenta de servicio de Google

Esto es un "usuario robot" que le da permiso al bot de escribir en tu
Google Sheet, sin usar tu cuenta personal de Gmail.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/) y
   entra con la cuenta de Google donde vive tu Sheet de mantenimiento.
2. Si es la primera vez que usas Google Cloud, acepta los términos (no
   tiene costo para esto, se queda dentro de la capa gratuita).
3. Arriba, junto al logo de "Google Cloud", dale clic al selector de
   proyecto y luego a **"Proyecto nuevo"**. Ponle de nombre algo como
   `Bot Mantenimiento Avila` y créalo.
4. Con ese proyecto seleccionado, ve al buscador de arriba y escribe
   **"Google Sheets API"** → dale clic al resultado → botón **"Habilitar"**.
   Repite lo mismo buscando **"Google Drive API"** → **"Habilitar"** (esta
   segunda solo hace falta si vas a guardar fotos/videos).
5. Ve al menú (☰) → **IAM y administración** → **Cuentas de servicio**.
6. Dale clic a **"+ Crear cuenta de servicio"**. Ponle de nombre
   `bot-mantenimiento`, dale "Continuar" y luego "Listo" (no hace falta
   asignarle roles especiales aquí).
7. En la lista de cuentas de servicio, dale clic a la que acabas de crear.
   Ve a la pestaña **"Claves"** → **"Agregar clave"** → **"Crear clave
   nueva"** → tipo **JSON** → **"Crear"**.
8. Se va a descargar un archivo `.json` a tu computadora. **Este archivo es
   la contraseña del bot para entrar a tus documentos de Google — guárdalo
   con cuidado y no lo compartas.** Renómbralo a `google-service-account.json`.
9. Abre ese archivo con el Bloc de Notas (o cualquier editor de texto) y
   busca un campo que dice `"client_email"` — copia ese correo, se ve algo
   así: `bot-mantenimiento@bot-mantenimiento-avila.iam.gserviceaccount.com`.

## Paso 2: Compartir tus documentos de Google con la cuenta de servicio

1. Abre tu Google Sheet **"Bitácora de Fallas Mecánicas"**.
2. Dale clic al botón **"Compartir"** (arriba a la derecha).
3. Pega ahí el correo de la cuenta de servicio que copiaste (el que
   termina en `.iam.gserviceaccount.com`), dale permiso de **Editor**, y
   guarda. Ahora el bot ya puede escribir en ese Sheet.
4. (Opcional, solo si quieres guardar fotos/videos) Crea o elige una
   carpeta de Google Drive donde se guardarán las fotos/videos de fallas,
   compártela con ese mismo correo (permiso de Editor), y copia el ID de
   esa carpeta de la URL: `https://drive.google.com/drive/folders/ESTE-ES-EL-ID`

## Paso 3: Subir el proyecto a un hosting

Te recomiendo **Railway** (railway.app) porque es de los más sencillos
para alguien que no programa - no necesitas usar la terminal ni instalar
nada en tu computadora.

1. Entra a [railway.app](https://railway.app) y crea una cuenta (puedes
   usar tu cuenta de Google).
2. Dale clic a **"New Project"** → **"Deploy from GitHub repo"**.
   - Si no tienes el proyecto en GitHub todavía, Railway también te deja
     subir el proyecto directo como carpeta con su comando de línea
     (`railway up`) — si prefieres esa ruta, dime y te explico esa opción
     paso a paso, o lo puedo dejar listo en un repositorio de GitHub para
     que solo le des clic a "Deploy".
3. Una vez creado el proyecto en Railway, ve a la pestaña **"Variables"**
   y agrega ahí, una por una, todas las variables que están en el archivo
   `.env.example` de este proyecto (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
   etc.) con sus valores reales.
4. Para el archivo `google-service-account.json`: en Railway puedes subirlo
   como un "archivo" en la sección de variables (Railway soporta variables
   de tipo archivo), o pegar todo su contenido como el valor de una
   variable y ajustar el código para leerlo así - dime cuál prefieres y te
   ayudo a dejarlo configurado.
5. Railway va a instalar el proyecto y darte una URL pública, algo como
   `https://bot-mantenimiento-avila-production.up.railway.app`.

## Paso 4: Conectar el webhook en Meta

1. Regresa a tu app **"Mantenimiento Avila"** en developers.facebook.com,
   sección **Paso 2: Configuración de producción** → **"Configurar
   webhooks"**.
2. En **"URL de devolución de llamada"** pon la URL que te dio Railway
   seguida de `/webhook`, por ejemplo:
   `https://bot-mantenimiento-avila-production.up.railway.app/webhook`
3. En **"Token de verificación"** pon EXACTAMENTE el mismo texto que
   pusiste en la variable `WHATSAPP_VERIFY_TOKEN` de Railway.
4. Dale clic a **"Verificar y guardar"**. Si todo está bien conectado,
   debería aceptarlo sin error.
5. Justo abajo, en la lista de campos del webhook, asegúrate de
   suscribirte al campo **"messages"** (es el que avisa cuando llega un
   mensaje nuevo).

## Cómo probarlo

Una vez conectado, pídele a alguien que le mande un mensaje de texto a tu
número de negocio (+52 1 56 5475 5062) diciendo algo como "ECO 204 se
poncho una llanta". En unos segundos debería:

1. Aparecer un renglón nuevo en tu Google Sheet con la fecha, el número,
   el mensaje, y el número de unidad detectado automáticamente (204).
2. Esa persona debería recibir de vuelta un mensaje de confirmación.

Si algo no aparece, revisa los "logs" (registro de actividad) de tu
proyecto en Railway - ahí se anota cualquier error con una descripción en
español de qué falló.

## Estructura del proyecto

```
bot-mantenimiento-avila/
├── package.json          Lista de dependencias del proyecto
├── .env.example           Plantilla de las variables que hay que configurar
├── src/
│   ├── server.js          Punto de entrada: recibe los webhooks de Meta
│   ├── whatsapp.js         Habla con la API de WhatsApp (leer/mandar mensajes)
│   ├── sheets.js           Escribe cada reporte en el Google Sheet
│   └── drive.js            Sube fotos/videos a Google Drive
```

## Preguntas frecuentes

**¿Y si un operador manda un audio o video muy largo?**
Se guarda igual, sin límite especial de tamaño de este lado (los límites
los pone WhatsApp, normalmente 16 MB para video/imagen y 100 MB para
documentos).

**¿Qué pasa si el bot se cae un rato?**
Meta reintenta mandar el mensaje varias veces si no le contestas a
tiempo, así que es poco probable que se pierda un reporte por una caída
corta. Aun así, lo ideal es revisar cada tanto los logs de Railway.

**¿Puedo agregar más columnas al Sheet (como "Criticidad" o "Sistema
afectado")?**
Sí, se puede enseñar al bot a detectar más cosas del texto del mensaje
(como ya hace con el número de ECO), o dejarlas para llenarse a mano por
el equipo de mantenimiento, igual que hoy.
