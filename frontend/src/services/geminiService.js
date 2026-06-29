import mammoth from 'mammoth';
import { analyzeDocumentViaScript } from '../google/sheetsApi';

async function extractFromArrayBuffer(arrayBuffer) {
  // mammoth preserva tablas (<table>) y negrita (<strong>), necesarios para el prompt
  const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer });
  return analyzeDocumentViaScript(htmlContent);
}

/** Extrae servicios de un archivo .docx subido localmente. */
export async function extractServicesFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  return extractFromArrayBuffer(arrayBuffer);
}

/** Extrae servicios de un .docx ya descargado de Drive como ArrayBuffer. */
export async function extractServicesFromArrayBuffer(arrayBuffer) {
  return extractFromArrayBuffer(arrayBuffer);
}
