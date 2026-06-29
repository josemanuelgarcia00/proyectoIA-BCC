import { getDriveFile } from '../google/sheetsApi';

const DRIVE_ID_RE = [
  /\/d\/([a-zA-Z0-9_-]{20,})/,      // .../file/d/ID/...
  /[?&]id=([a-zA-Z0-9_-]{20,})/,    // ...?id=ID
];

/** Extrae el ID de un enlace de Google Drive, o devuelve el texto tal cual si parece un ID directo. */
export function extractDriveFileId(urlOrId) {
  const str = (urlOrId || '').trim();
  for (const re of DRIVE_ID_RE) {
    const m = str.match(re);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{25,}$/.test(str)) return str;
  return null;
}

/**
 * Descarga un .docx de Google Drive a través del Apps Script y devuelve
 * { arrayBuffer: ArrayBuffer, name: string }.
 */
export async function fetchDocxFromDrive(urlOrId) {
  const fileId = extractDriveFileId(urlOrId);
  if (!fileId) {
    throw new Error('URL no reconocida. Pega el enlace completo de Google Drive (Compartir → Copiar enlace).');
  }

  const data = await getDriveFile(fileId);

  // atob devuelve una cadena binaria; la convertimos a ArrayBuffer
  const binaryStr = atob(data.base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return { arrayBuffer: bytes.buffer, name: data.name };
}
