const { google } = require('googleapis');
const { Readable } = require('stream');

/**
 * Integración con Google Drive para el almacenamiento de documentos.
 *
 * Requiere dos variables de entorno:
 *   - GOOGLE_SERVICE_ACCOUNT_JSON: el contenido COMPLETO del archivo JSON de la
 *     cuenta de servicio de Google Cloud (como una sola línea de texto).
 *   - GOOGLE_DRIVE_ROOT_FOLDER_ID: el ID de la carpeta de Drive (compartida con
 *     el correo de la cuenta de servicio, con permiso de Editor) donde se
 *     crearán las subcarpetas de cada estudiante.
 *
 * Si estas variables no están configuradas, las funciones lanzan un error
 * controlado en vez de fallar de forma confusa — así el resto de la app
 * (guardar la ficha) sigue funcionando aunque la carga de documentos no esté
 * lista todavía.
 */

let driveClient = null;
let inicializacionFallo = null;

function obtenerCliente() {
  if (driveClient) return driveClient;
  if (inicializacionFallo) throw inicializacionFallo;

  const credencialesJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credencialesJson) {
    inicializacionFallo = new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON no está configurada. La carga de documentos a Google Drive no está disponible.'
    );
    throw inicializacionFallo;
  }

  let credenciales;
  try {
    credenciales = JSON.parse(credencialesJson);
  } catch (err) {
    inicializacionFallo = new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene un JSON válido.');
    throw inicializacionFallo;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credenciales,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function carpetaRaiz() {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID no está configurada.');
  return id;
}

// Quita acentos y caracteres no válidos para nombres de carpeta/archivo en Drive.
function nombreSeguro(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .slice(0, 120);
}

/**
 * Obtiene (o crea si no existe) la carpeta de Drive de un estudiante,
 * nombrada como "CURP_ApellidoPaterno_ApellidoMaterno_Nombres" (o solo el
 * nombre completo si no hay CURP todavía).
 */
async function obtenerOCrearCarpetaEstudiante({ curp, primerApellido, segundoApellido, nombres }) {
  const drive = obtenerCliente();
  const nombreCarpeta = nombreSeguro(
    [curp, primerApellido, segundoApellido, nombres].filter(Boolean).join('_')
  ) || `ficha_${Date.now()}`;

  const parent = carpetaRaiz();

  const busqueda = await drive.files.list({
    q: `name = '${nombreCarpeta.replace(/'/g, "\\'")}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    corpora: 'allDrives',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (busqueda.data.files && busqueda.data.files.length) {
    return busqueda.data.files[0].id;
  }

  const nuevaCarpeta = await drive.files.create({
    requestBody: {
      name: nombreCarpeta,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parent],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  return nuevaCarpeta.data.id;
}

/**
 * Sube un archivo (buffer en memoria) a una carpeta de Drive, con un nombre
 * ya definido por quien llama (convención: CURP_TipoDeDocumento.ext).
 * Devuelve el fileId de Drive.
 */
async function subirArchivo({ buffer, nombreArchivo, mimeType, carpetaId }) {
  const drive = obtenerCliente();

  const respuesta = await drive.files.create({
    requestBody: {
      name: nombreArchivo,
      parents: [carpetaId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  return { fileId: respuesta.data.id, url: respuesta.data.webViewLink };
}

module.exports = {
  obtenerOCrearCarpetaEstudiante,
  subirArchivo,
  nombreSeguro,
};
