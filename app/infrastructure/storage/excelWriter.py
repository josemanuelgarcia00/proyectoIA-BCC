import re
import pandas as pd
from typing import List
from app.domain.service import ServiceEntity, ExcelRowData
from app.infrastructure.storage.excelReader import ExcelReader

DICTIONARY_COLUMNS = [
    "servicio", "app", "tipo", "verbo", "ambito", "uso_funcional",
    "entradas", "salidas", "invoca", "tablas_referenciales",
    "documento_origen | version", "fiabilidad"
]


class ExcelWriter:
    """Escribe el resultado de la revisión de conflictos en el Excel de origen"""

    def __init__(self, file_path: str):
        self.file_path = file_path

    def save_dictionary(self, services: List[ServiceEntity]) -> int:
        """
        Hace un upsert del dato final de cada servicio revisado (su última iteración,
        ya sin conflictos pendientes) sobre la hoja Diccionario: si el servicio ya
        existe se sobrescribe su fila, si no existe se añade. Las filas de servicios
        no tocados en esta sesión se conservan. La hoja Perímetro no se toca.
        Devuelve el número de servicios escritos (añadidos o sobrescritos).
        """
        rows_by_service = self._read_existing_dictionary()

        upserted = 0
        for service in services:
            if service.consolidated_status == "Desechado":
                continue
            if not service.perimeter_iterations:
                continue
            if any(it.conflicts for it in service.perimeter_iterations):
                continue

            # Si el servicio fue cerrado ("Aceptar Cambios"), winning_data ya es el
            # resultado unificado con el maestro; si no, usamos la última iteración.
            final_data = service.winning_data if service.closed and service.winning_data else service.perimeter_iterations[-1].data
            rows_by_service[service.name] = self._row_from_data(service.name, final_data)
            upserted += 1

        if upserted == 0:
            return 0

        df = pd.DataFrame(rows_by_service.values(), columns=DICTIONARY_COLUMNS)

        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Diccionario", index=False)

        return upserted

    def _read_existing_dictionary(self) -> dict:
        """
        Lee la hoja Diccionario actual y normaliza cada fila al formato de escritura,
        indexada por nombre de servicio, para poder hacer upsert sin perder las filas
        que ya existían y no se tocan en esta sesión.
        """
        try:
            reader = ExcelReader(self.file_path)
            dictionary_records, _ = reader.read_excel_sheets()
        except (FileNotFoundError, ValueError):
            return {}

        existing = {}
        for record in dictionary_records:
            raw_key = str(record.get(list(record.keys())[0], "")).strip()
            if not raw_key or raw_key.lower() == "nan":
                continue

            service_name = re.sub(r'\s\(\d+\)$', '', raw_key).strip().upper()
            row_data = reader._record_to_excel_row_data(record)
            existing[service_name] = self._row_from_data(service_name, row_data)

        return existing

    @staticmethod
    def _format_document_version(source_document: str, doc_version: str) -> str:
        """Combina documento de origen y versión en el formato de columna única
        del Diccionario, p.ej. 'AF_Solicitud....docx | v2.0'."""
        if not source_document:
            return ""
        if not doc_version:
            return source_document
        version_label = doc_version if doc_version.lower().startswith("v") else f"v{doc_version}"
        return f"{source_document} | {version_label}"

    @staticmethod
    def _row_from_data(service_name: str, data: ExcelRowData) -> dict:
        return {
            "servicio": service_name,
            "app": data.app,
            "tipo": data.type,
            "verbo": data.verb,
            "ambito": data.scope,
            "uso_funcional": data.functional_use,
            "entradas": ";".join(data.inputs),
            "salidas": ";".join(data.outputs),
            "invoca": ";".join(data.invokes),
            "tablas_referenciales": ";".join(data.reference_tables),
            "documento_origen | version": ExcelWriter._format_document_version(data.source_document, data.doc_version),
            "fiabilidad": data.reliability
        }
