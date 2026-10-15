# Guía para poner el bot nuevo en Railway

Para: Oscar o Max Junior. Tiempo estimado: 30–45 minutos.

## Qué hace el bot nuevo

El operador manda una **foto** al mismo número de siempre (+52 1 56 5475 5062). El bot le muestra una lista de tipos de reporte, luego la lista de **sus viajes** activos, y le pide solo lo necesario:

| Tipo | Qué pregunta | A dónde va |
|---|---|---|
| Acuse de entrega | viaje y quién firmó | Geo: acuse ligado al viaje y el viaje pasa a "completado" solo |
| Combustible | viaje, litros, importe | Bandeja de Geo (Operaciones → Reportes del Bot) |
| Carga de salida, Llegada a destino, Incidencia, Tránsito, Clima, Otro | viaje (si aplica) y nota corta | Bandeja de Geo |
| Falla mecánica | ECO y qué falla | Hoja de Google (igual que hoy) **y** Bandeja de Geo |

Un mensaje de **solo texto** sin foto se sigue tratando como falla mecánica, exactamente como hoy (misma respuesta al operador). Escribir "menú" muestra la lista sin foto; "cancelar" borra el reporte en curso.

## Antes de empezar (requisitos)

1. **Geo debe estar en internet** con una dirección pública (por ejemplo `https://geo.transportesavila.mx`). Mientras Geo viva solo en la Mac de Oscar, Railway no puede llegar a él. Si se despliega antes, el bot sigue funcionando para fallas (la hoja de Google) pero los demás reportes responderán "problema técnico".
2. Confirmar que en Geo abre bien `https://TU-DOMINIO/bd/api_bot.php` (debe responder `{"error":"No autorizado"}`; eso es lo correcto sin clave).
3. En Geo: **Operaciones → Reportes del Bot → "Mostrar clave del bot"** (solo Tesorería). Copiar esa clave, es el valor de `GEO_BOT_TOKEN`.
4. En la Plantilla de Geo, cada operador debe tener su **celular** capturado. Así el bot lo reconoce y le muestra sus viajes. Sin celular, el bot le pide el folio a mano.

## Paso 1: respaldar lo que hoy funciona

1. Entrar a Railway → proyecto **bot-mantenimiento-avila** → servicio → pestaña **Deployments**.
2. Anotar cuál es el despliegue activo. Ese es el que se puede restaurar (ver "Cómo regresar").
3. Si el código actual está en GitHub, hacer una rama de respaldo (`git branch respaldo-bot-v1`). Si no está en GitHub, pedirle a Max Junior que descargue el código actual **antes** de reemplazarlo.
4. Max Junior: compara el código actual con `lib/falla.js` y `lib/sheets.js`. El bot nuevo imita lo observado (ECO, categorías, prioridad Alta/Por revisar, columnas I:Q de la hoja), pero si el original tiene palabras clave distintas, se ajustan ahí.

## Paso 2: subir el código nuevo

Opción A (recomendada, si el bot ya está conectado a GitHub): reemplazar los archivos del repositorio por los de esta carpeta (`index.js`, `package.json`, carpeta `lib/`), hacer commit y push. Railway despliega solo.

Opción B: instalar la CLI de Railway (`npm i -g @railway/cli`), entrar en esta carpeta, `railway login`, `railway link` (elegir el proyecto y servicio) y `railway up`.

No subir las carpetas `node_modules` ni `test`.

## Paso 3: variables de entorno

En Railway → servicio → **Variables**. Las que ya existen se **dejan igual**:

`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `GOOGLE_SHEETS_ID`, `GOOGLE_SHEET_TAB_NAME` (Untitled), `GOOGLE_SERVICE_ACCOUNT_JSON`

Agregar dos nuevas:

- `GEO_API_URL` = `https://TU-DOMINIO/bd/api_bot.php`
- `GEO_BOT_TOKEN` = la clave copiada de Geo

Al guardar, Railway reinicia el servicio.

## Paso 4: probar (con tu propio celular)

Usa un celular que ya sea el de un operador de prueba en la Plantilla.

1. Escribe `ECO 45 no frena bien`. Debe responder "Recibimos tu reporte..." y aparecer una fila nueva en la hoja (columnas I a Q) y en la Bandeja de Geo.
2. Manda una foto cualquiera. Debe salir la lista de tipos. Elige **Acuse de entrega**, elige un viaje, escribe un nombre. Debe responder que el acuse quedó registrado y en Geo el viaje aparece "✓ Acuse".
3. Manda foto → **Combustible** → viaje → litros → importe. Debe aparecer en la Bandeja como "nuevo".
4. En Railway → **Logs** no deben aparecer líneas "Geo reporte falló" ni "Sheets falló".

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| "No pude guardar tu reporte por un problema técnico" | `GEO_API_URL` o `GEO_BOT_TOKEN` mal, Geo apagado o sin dirección pública |
| El bot no muestra los viajes y pide folio | El celular del operador no está en la Plantilla, o no tiene viajes confirmados/en curso |
| Nadie recibe respuesta | Revisar el webhook en Meta (misma URL de siempre `.../webhook`) y `WHATSAPP_APP_SECRET` |
| Las fallas ya no llegan a la hoja | Revisar `GOOGLE_SERVICE_ACCOUNT_JSON` y que la hoja siga compartida con la cuenta de servicio |

## Cómo regresar al bot anterior

Railway → **Deployments** → en el despliegue anterior, menú (⋯) → **Redeploy** (o **Rollback**). Tarda un minuto. Las variables nuevas no estorban al código viejo.

## Notas de seguridad

- La clave del bot (`GEO_BOT_TOKEN`) es como una contraseña. No se comparte por WhatsApp ni correo. Si se filtra, se borra el archivo de credenciales de Geo `bot_geo_token.txt` (Max Junior sabe cuál) y se genera una nueva.
- El bot valida que cada mensaje venga realmente de Meta (`WHATSAPP_APP_SECRET`). No dejar esa variable vacía.
- Las fotos se guardan en Geo en una carpeta privada; no son accesibles por internet sin sesión.

## Pendiente para más adelante

- El combustible del bot queda en la Bandeja para que el personal lo revise; todavía no se aplica solo al módulo de Combustible.
- El estado de cada conversación vive en memoria: si Railway reinicia, un reporte a medias se pierde y el operador solo lo vuelve a empezar.
