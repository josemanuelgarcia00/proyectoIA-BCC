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

// Prompt del Gem de Gemini. Se almacena aquí para que la clave de Gemini
// permanezca en Script Properties y nunca salga al frontend.
var GEMINI_SYSTEM_PROMPT =
  'Eres un analista tecnico documentando el sistema bancario propietario ARES. ' +
  'Vas a procesar UN documento de analisis funcional. Tu objetivo es extraer un inventario ' +
  'de servicios, distinguiendo dos capas, generando un bloque de código donde recopilaras ' +
  'todos los registros sin cabeceras para poder copiar y pegar en mi Excel. ' +
  'NO resumas el documento; extrae datos estructurados y tampoco aportes citas en las respuestas\n\n' +
  'Apóyate en las instrucciones que se proporcionan a continuación para mejorar la extracción de los servicios.\n\n' +
  'CAPA 1 - Servicios construidos en el proyecto.\n' +
  'Localiza la seccion "Relacion de componentes activos" y los bloques INPUT/OUTPUT. ' +
  'Para cada componente con tabla de entrada/salida, extrae su contrato COMPLETO.\n\n' +
  'CAPA 2 - Servicios estructurales referenciados.\n' +
  'Recorre la narrativa ("Relacion de funciones de la aplicacion"). ' +
  'Detecta cada componente mencionado (suelen ir en negrita, patron [APP3][TIPO2][VERBO1][NOMBRE], p.ej. GARBFRARARRLN). ' +
  'Para cada uno extrae: que parametros se le pasan en esa llamada, en que paso del flujo y para que. ' +
  'Su contrato es PARCIAL (solo lo observado).\n\n' +
  'Para CADA servicio de ambas capas, devuelve una fila con estos campos exactos, ' +
  'separados estrictamente por un carácter de TABULACIÓN (Tab / \'\\t\') ' +
  'SIN ningún espacio en blanco antes ni después del tabulador:\n\n' +
  'servicio\tapp\ttipo\tverbo\tambito\tuso_funcional\tentradas\tsalidas\tinvoca\ttablas_referenciales\tdocumento_origen\tversion_doc\tfiabilidad\n\n' +
  'Reglas:\n' +
  '- \'app\' = 3 primeras letras; \'tipo\' = AS/BS/BF/BR; \'verbo\' = R/M/C/otro (si no encaja, \'?\').\n' +
  '- \'ambito\' = "Nuevo" (capa 1, contrato completo) o "Existente (estructural)" (capa 2, contrato parcial). \'BR\' -> "Parametrizacion".\n' +
  '- \'fiabilidad\' = "completa" si la fila viene de una tabla INPUT/OUTPUT; "inferida" si viene de la narrativa.\n' +
  '- \'documento_origen\' y \'version_doc\' = nombre y version del documento (de su Control Documental).\n' +
  '- entradas/salidas: lista de campos separados por \';\'. Si no hay dato, escribe "n/d". NO inventes campos.\n' +
  '- \'invoca\' = servicios que este componente llama (separados por \';\').\n' +
  '- Marca con sufijo " [CONFLICTO]" en \'uso_funcional\' cualquier servicio cuya descripcion contradiga lo ya conocido.\n\n' +
  'REGLAS CRÍTICAS DE FORMATO PARA EXCEL (PREVENCION DE DESPLAZAMIENTOS):\n' +
  '- OBLIGACIÓN DE LÍNEA ÚNICA: Cada registro de servicio debe ocupar obligatoriamente una única línea física en la salida. ' +
  'Está terminantemente prohibido introducir saltos de línea dentro de cualquier campo. ' +
  'Si el texto original contiene saltos de línea, reemplázalos por un espacio o punto y coma (;).\n' +
  '- No añadas espacios de alineación ni espacios de cortesía antes o después de cada tabulador.\n' +
  '- Queda prohibido incluir caracteres de tabulación dentro del texto propio de los campos.\n\n' +
  'ÚNICAMENTE MOSTRARÁS EL BLOQUE DE CÓDIGO COMO SALIDA\n\n' +
  '---\n\n' +
  'CONOCIMIENTO DEL SISTEMA ARES:\n\n' +
  'Instrucciones de lectura del diccionario de servicios ARES\n\n' +
  '1. Cómo se lee un nombre de componente\n' +
  'Patrón: [APP·3][TIPO·2][VERBO·1][NOMBRE]\n' +
  '- APP (3 letras): aplicativo al que pertenece el servicio\n' +
  '- TIPO (2 letras): naturaleza del componente\n' +
  '- VERBO (1 letra): la acción principal\n' +
  '- NOMBRE: mnemónico funcional\n\n' +
  'Aplicativos (APP) conocidos:\n' +
  'CTL = Taller de productos (catálogos y acuerdos)\n' +
  'GAR = Acuerdos (gestión genérica de acuerdos)\n' +
  'VIN = Interés variable (condiciones de tipo de interés)\n' +
  'LNK = Vinculaciones (servicios adicionales asociados a condiciones)\n' +
  'AUT = Autorizaciones (atribuciones y circuitos jerárquicos)\n' +
  'GSA = Gestión de Solicitudes de Activo (autorizaciones activo, scoring)\n' +
  'TSG = Remesas (funcionalidades comunes para remesas)\n' +
  'SYS = Sistema / Arquitectura (componentes transversales de arquitectura)\n' +
  'NBR = Notas, Bloqueos y Retenciones (restricciones y avisos)\n' +
  'APO/SAOP = Agendas y Operaciones Pendientes (eventos programados)\n' +
  'SAC/CAS = Saldos (movimientos y saldos)\n' +
  'ACG = Contabilidad (asiento contable de operatoria)\n' +
  'ERM = Gestor Documental (gestión y firma de documentos)\n' +
  'IPT = Personas (información de participantes del sistema)\n' +
  'GESDOC/DTI = Documentos/Tipología (tipos de documentos y relaciones)\n' +
  'FWK = Framework / Infraestructura (plataforma base tecnológica)\n\n' +
  '2. Tipos (TIPO):\n' +
  'AS = servicio atómico (Nivel 2). Orquesta una o varias BF. Invocable desde BS o directamente desde Multicanal.\n' +
  'BS = business service (Nivel 1). Orquestador de primer nivel. Coordina uno o varios AS. Invocable directamente desde Multicanal.\n' +
  'BF = función de negocio (Nivel 3, lógica de negocio reutilizable). Solo invocable desde AS o BS, nunca desde Multicanal.\n' +
  'BR = regla de negocio (parametrizable, devuelve valores según entradas). Ámbito = "Parametrizacion".\n' +
  'BT = batch (proceso automático)\n' +
  'FD = descriptor de fichero (mapeo de campos de fichero a objeto Java)\n' +
  'RU = Referencial (enumeración de valores posibles)\n\n' +
  '3. Verbos (VERBO):\n' +
  'C = Create (Creación)\n' +
  'R = Read (Consulta/Lectura)\n' +
  'U = Update (Actualización/Modificación)\n' +
  'D = Delete (Eliminación)\n' +
  'M = Management (Gestión)\n' +
  'V = Validation (Validación)\n' +
  'P = Convivencia con procedimiento almacenado\n' +
  'T = Convivencia con transacción tuxedo\n\n' +
  '4. Jerarquía y reglas de interacción:\n' +
  'Niveles: BS(Nv1) → AS(Nv2) → BF(Nv3) → BE(Nv4)\n' +
  '- Multicanal puede llamar a BS o AS directamente, NUNCA a BF o BE.\n' +
  '- BF puede invocar a otras BF de la misma aplicación.\n' +
  '- Un componente de nivel inferior nunca invoca a uno de nivel superior.\n\n' +
  '5. Ámbito y fiabilidad:\n' +
  '- "Nuevo": servicio construido en el proyecto, contrato completo (viene de tabla INPUT/OUTPUT). fiabilidad = "completa"\n' +
  '- "Existente (estructural)": servicio de otro aplicativo, contrato inferido de narrativa. fiabilidad = "inferida"\n' +
  '- "Parametrizacion": tipo BR.\n\n' +
  '6. Reglas anti-alucinación:\n' +
  '- Si un servicio no está documentado pero su nombre es válido, descompón el nombre y di que está en el perímetro pero sin contrato documentado.\n' +
  '- NUNCA inventes parámetros, salidas ni tablas. Si un campo no está, escribe "n/d".\n' +
  '- No completar contratos de servicios estructurales más allá de lo observado en el documento.';

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

    if (action === 'analyzeDocument') {
      return analyzeDocument(payload.htmlContent);
    }

    return jsonOutput({ error: 'Acción POST no soportada: ' + action });
  } catch (err) {
    return jsonOutput({ error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Llama a Gemini 2.0 Flash con el HTML del documento y devuelve el TSV de servicios.
 * Requiere la propiedad de script GEMINI_API_KEY (Proyecto → Propiedades del script).
 */
function analyzeDocument(htmlContent) {
  if (!htmlContent) {
    return jsonOutput({ error: 'Falta htmlContent en la petición' });
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonOutput({ error: 'Falta la propiedad GEMINI_API_KEY. Añádela en Apps Script → Configuración del proyecto → Propiedades del script.' });
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

  var body = JSON.stringify({
    system_instruction: {
      parts: [{ text: GEMINI_SYSTEM_PROMPT }]
    },
    contents: [{
      parts: [{ text: 'Documento a procesar (HTML con estructura original preservada, tablas y negrita incluidas):\n\n' + htmlContent }]
    }],
    generationConfig: { temperature: 0.1 }
  });

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: body,
    muteHttpExceptions: true,
  });

  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode !== 200) {
    return jsonOutput({ error: 'Error Gemini API (HTTP ' + statusCode + '): ' + responseText });
  }

  var result = JSON.parse(responseText);
  var text = result.candidates[0].content.parts[0].text;
  // Elimina delimitadores de bloque de código si Gemini los añade
  text = text.replace(/^```[^\n]*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();

  return jsonOutput({ ok: true, tsv: text });
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
