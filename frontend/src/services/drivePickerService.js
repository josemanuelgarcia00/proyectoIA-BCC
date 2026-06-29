/**
 * Abre el selector de archivos nativo de Google Drive mediante la Picker API.
 * Requiere VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY en .env.
 *
 * Setup en Google Cloud Console (una sola vez):
 *   1. Habilitar "Google Picker API" y "Google Drive API"
 *   2. Crear API Key → restringir a Google Picker API
 *   3. Crear OAuth 2.0 Client ID (tipo "Aplicación web")
 *      → Añadir en "Orígenes de JavaScript autorizados":
 *          http://localhost:5173   (desarrollo)
 *          https://<tu-usuario>.github.io  (producción)
 */

let _gapiReady    = false;
let _gisReady     = false;
let _pickerReady  = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Error cargando ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureReady() {
  await Promise.all([
    _gapiReady ? null : loadScript('https://apis.google.com/js/api.js').then(() => { _gapiReady = true; }),
    _gisReady  ? null : loadScript('https://accounts.google.com/gsi/client').then(() => { _gisReady = true; }),
  ]);
  if (!_pickerReady) {
    await new Promise((resolve) => window.gapi.load('picker', resolve));
    _pickerReady = true;
  }
}

function requestAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error_description || resp.error));
        else resolve(resp.access_token);
      },
    });
    // prompt: '' reutiliza el token si la sesión ya está activa
    client.requestAccessToken({ prompt: '' });
  });
}

/**
 * Abre el selector de archivos de Google Drive filtrando por .docx.
 * Devuelve { fileId, name, accessToken } del archivo seleccionado.
 * Lanza 'cancelled' si el usuario cierra el picker sin seleccionar.
 */
export async function openDriveFilePicker() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const apiKey   = import.meta.env.VITE_GOOGLE_API_KEY;

  if (!clientId || !apiKey) {
    throw new Error(
      'Faltan VITE_GOOGLE_CLIENT_ID y/o VITE_GOOGLE_API_KEY en el archivo .env.\n' +
      'Consulta la documentación de setup del Google Drive Picker.'
    );
  }

  await ensureReady();
  const accessToken = await requestAccessToken(clientId);

  return new Promise((resolve, reject) => {
    const { PickerBuilder, DocsView, Action } = window.google.picker;

    const view = new DocsView()
      .setMimeTypes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .setSelectFolderEnabled(false);

    const picker = new PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setTitle('Selecciona el Análisis Funcional (.docx)')
      .setCallback((data) => {
        if (data.action === Action.PICKED) {
          const f = data.docs[0];
          resolve({ fileId: f.id, name: f.name, accessToken });
        } else if (data.action === Action.CANCEL) {
          reject(new Error('cancelled'));
        }
      })
      .build();

    picker.setVisible(true);
  });
}

/**
 * Descarga el contenido binario del archivo usando el token OAuth del picker.
 * Devuelve un ArrayBuffer listo para pasar a mammoth.
 */
export async function downloadWithToken(fileId, accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`No se pudo descargar el archivo de Drive (HTTP ${res.status})`);
  return res.arrayBuffer();
}
