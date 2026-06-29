import { createExcelRowData } from '../domain/models';

/**
 * Convierte el bloque TSV devuelto por Gemini en un array de servicios
 * con la estructura { name, data: ExcelRowData } lista para usar en la app.
 *
 * Columnas esperadas (en orden):
 * servicio | app | tipo | verbo | ambito | uso_funcional |
 * entradas | salidas | invoca | tablas_referenciales |
 * documento_origen | version_doc | fiabilidad
 */
export function parseTSV(tsvString) {
  return tsvString
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => {
      const cols = line.split('\t');
      const [
        servicio = '',
        app = '',
        tipo = '',
        verbo = '',
        ambito = '',
        uso_funcional = '',
        entradas = '',
        salidas = '',
        invoca = '',
        tablas_referenciales = '',
        documento_origen = '',
        version_doc = '',
        fiabilidad = '',
      ] = cols;

      const splitList = (val) => {
        const v = (val || '').trim();
        if (!v || v.toLowerCase() === 'n/d') return [];
        return v.split(';').map((s) => s.trim()).filter(Boolean);
      };

      return {
        name: servicio.trim(),
        data: createExcelRowData({
          app: app.trim(),
          type: tipo.trim(),
          verb: verbo.trim(),
          scope: ambito.trim(),
          functional_use: uso_funcional.trim(),
          inputs: splitList(entradas),
          outputs: splitList(salidas),
          invokes: splitList(invoca),
          reference_tables: splitList(tablas_referenciales),
          source_document: documento_origen.trim(),
          doc_version: version_doc.trim(),
          reliability: fiabilidad.trim(),
        }),
      };
    })
    .filter((s) => s.name.length > 0);
}
