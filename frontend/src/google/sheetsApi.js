/**
 * Sustituye a gspread (usado antes por googleSheetsClient.py y los lectores/
 * escritores de Google Sheets): lee y ESCRIBE el Sheet a través de un Google
 * Apps Script propio (ver /apps-script/Code.gs), que se ejecuta con la
 * identidad de Google de quien lo publicó. Así el Sheet puede quedarse privado
 * y no hace falta ninguna credencial (API key, cuenta de servicio...) en el
 * frontend.
 *
 * ⚠️ Sin login ni token, cualquiera con la URL del Apps Script puede leer y
 * escribir el Sheet. Es una decisión consciente y temporal: más adelante se
 * añadirá OAuth de Google para limitar quién puede escribir.
 */
import { APPS_SCRIPT_URL } from '../config';

export function hasWriteAccess() {
  return true;
}

async function callAppsScriptGet(params) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Falta VITE_APPS_SCRIPT_URL para leer el Sheet (ver apps-script/Code.gs).');
  }

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${APPS_SCRIPT_URL}?${query}`);
  if (!res.ok) {
    throw new Error(`Error al leer el Sheet (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function callAppsScriptPost(payload) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('Falta VITE_APPS_SCRIPT_URL para escribir en el Sheet (ver apps-script/Code.gs).');
  }

  // Content-Type text/plain a propósito: el navegador lo trata como "simple
  // request" y evita el preflight CORS (OPTIONS), que Apps Script no responde.
  // El Code.gs hace JSON.parse(e.postData.contents) igualmente.
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Error al escribir en el Sheet (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function listSheetTitles() {
  const data = await callAppsScriptGet({ action: 'meta' });
  return data.titles || [];
}

export async function getSheetValues(_sheetId, sheetName) {
  const data = await callAppsScriptGet({ action: 'values', sheet: sheetName });
  if (data.values == null) {
    throw new Error(`La hoja '${sheetName}' no existe en el Sheet`);
  }
  return data.values;
}

/** Igual que getSheetValues, pero devuelve null si la hoja no existe (en vez de lanzar). */
export async function readOptionalSheetValues(_sheetId, sheetName) {
  const data = await callAppsScriptGet({ action: 'values', sheet: sheetName });
  return data.values;
}

/** Reescribe la hoja completa: la crea si no existe, la limpia y vuelca la tabla 2D.
 * Es la única primitiva de escritura: el writer y el log de auditoría pasan por aquí. */
export async function clearAndWrite(_sheetId, sheetName, values) {
  await callAppsScriptPost({ action: 'clearAndWrite', sheet: sheetName, values });
}

/** Igual que gspread worksheet.get_all_records(): primera fila = cabecera. */
export function recordsFromValues(values) {
  if (!values || values.length === 0) return [];
  const header = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const record = {};
    header.forEach((col, idx) => {
      record[col] = row[idx] !== undefined ? row[idx] : '';
    });
    return record;
  });
}
