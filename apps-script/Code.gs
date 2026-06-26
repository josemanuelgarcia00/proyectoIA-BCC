/**
 * Google Apps Script — puente lectura/escritura entre el frontend estático
 * (GitHub Pages) y el Google Sheet del Gestor de Conflictos.
 *
 * Sustituye al antiguo backend FastAPI + gspread + credentials.json. Se ejecuta
 * con la identidad de quien lo publica (debe tener acceso al Sheet), así que el
 * Sheet puede quedarse privado y el frontend no lleva ninguna credencial.
 *
 * PUBLICACIÓN
 *   1. script.google.com → Nuevo proyecto. Pega este archivo en Code.gs.
 *   2. Pon SHEET_ID abajo con el ID de tu Sheet
 *      (https://docs.google.com/spreadsheets/d/<ESTO>/edit).
 *   3. Implementar → Nueva implementación → tipo "Aplicación web":
 *        - Ejecutar como: Yo
 *        - Quién tiene acceso: Cualquier usuario, incluso anónimos  ← CRÍTICO para CORS
 *          (Si pones solo "Cualquier usuario" Google exige login y rompe CORS en el navegador)
 *   4. Autoriza los permisos. Copia la URL que termina en /exec → es
 *      VITE_APPS_SCRIPT_URL en el frontend.
 *   5. Cada cambio de este código requiere "Gestionar implementaciones →
 *      Nueva versión" para que la URL publicada lo use.
 *
 * ⚠️ Con acceso anónimo cualquiera con la URL puede leer y escribir el Sheet.
 * Es una decisión consciente y temporal; más adelante se añadirá OAuth.
 *
 * API
 *   GET  ?action=meta                      → { titles: [<nombres de hoja>] }
 *   GET  ?action=values&sheet=<nombre>     → { values: [[...]] } | { values: null }
 *   POST { action:'clearAndWrite', sheet, values }  → crea/limpia la hoja y vuelca values
 */

// ⚠️ OBLIGATORIO: cambia este valor por el ID real de tu Sheet antes de desplegar.
// Lo encuentras en la URL: https://docs.google.com/spreadsheets/d/<ESTE_ID>/edit
var SHEET_ID = 'PON_AQUI_EL_ID_DEL_SHEET';

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function doGet(e) {
  try {
    if (!SHEET_ID || SHEET_ID === 'PON_AQUI_EL_ID_DEL_SHEET') {
      return jsonOutput({ error: 'SHEET_ID no configurado — edita Code.gs y redespliega.' });
    }
    var params = (e && e.parameter) || {};
    var action = params.action;

    if (action === 'meta') {
      var titles = getSpreadsheet().getSheets().map(function (s) { return s.getName(); });
      return jsonOutput({ titles: titles });
    }

    if (action === 'values') {
      var sheet = getSpreadsheet().getSheetByName(params.sheet);
      if (!sheet) {
        // Hoja inexistente: null para que el frontend trate las hojas
        // opcionales (Desechados, Auditoria, Perímetro_Historico) como vacías.
        return jsonOutput({ values: null });
      }
      var range = sheet.getDataRange();
      var values = range ? range.getValues() : [];
      return jsonOutput({ values: values });
    }

    return jsonOutput({ error: 'Acción GET no soportada: ' + action });
  } catch (err) {
    return jsonOutput({ error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput({ error: 'Falta el cuerpo de la petición' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'clearAndWrite') {
      return clearAndWrite(payload.sheet, payload.values);
    }

    if (action === 'appendRows') {
      return appendRows(payload.sheet, payload.values);
    }

    if (action === 'getDriveFile') {
      return getDriveFile(payload.fileId);
    }

    return jsonOutput({ error: 'Acción POST no soportada: ' + action });
  } catch (err) {
    return jsonOutput({ error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Descarga un archivo de Google Drive por su ID y lo devuelve como base64.
 * El Apps Script debe tener acceso al archivo (compartido con el propietario del script).
 */
function getDriveFile(fileId) {
  if (!fileId) {
    return jsonOutput({ error: 'Falta fileId' });
  }
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());
    return jsonOutput({
      ok: true,
      name: file.getName(),
      mimeType: blob.getContentType(),
      base64: base64,
    });
  } catch (err) {
    return jsonOutput({ error: 'No se puede acceder al archivo en Drive: ' + String(err.message || err) });
  }
}

/** Añade filas al final de la hoja sin borrar el contenido existente (headers incluidos). */
function appendRows(sheetName, values) {
  if (!sheetName) {
    return jsonOutput({ error: 'Falta el nombre de la hoja' });
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return jsonOutput({ error: 'La hoja "' + sheetName + '" no existe' });
  }

  var rows = values || [];
  if (rows.length === 0) {
    return jsonOutput({ ok: true, added: 0 });
  }

  var maxCols = rows.reduce(function (m, row) { return Math.max(m, row.length); }, 0);
  var normalized = rows.map(function (row) {
    var copy = row.slice();
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, normalized.length, maxCols).setValues(normalized);

  return jsonOutput({ ok: true, added: rows.length });
}

/** Crea la hoja si no existe, la limpia por completo y escribe la tabla 2D. */
function clearAndWrite(sheetName, values) {
  if (!sheetName) {
    return jsonOutput({ error: 'Falta el nombre de la hoja' });
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  sheet.clearContents();

  var rows = values || [];
  if (rows.length > 0) {
    var maxCols = rows.reduce(function (m, row) { return Math.max(m, row.length); }, 0);
    // Normaliza a rectángulo: setValues exige que todas las filas tengan el mismo nº de columnas.
    var normalized = rows.map(function (row) {
      var copy = row.slice();
      while (copy.length < maxCols) copy.push('');
      return copy;
    });
    sheet.getRange(1, 1, normalized.length, maxCols).setValues(normalized);
  }

  return jsonOutput({ ok: true, rows: rows.length });
}
