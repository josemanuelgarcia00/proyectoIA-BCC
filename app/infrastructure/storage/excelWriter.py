import pandas as pd
from typing import List
from app.domain.service import ServiceEntity, ExcelRowData

DICTIONARY_COLUMNS = [
    "servicio", "app", "tipo", "verbo", "ambito", "uso_funcional",
    "entradas", "salidas", "invoca", "tablas_referenciales",
    "documento_origen", "version_doc", "fiabilidad"
]


class ExcelWriter:
    """Escribe el resultado de la revisión de conflictos en el Excel de origen"""

    def __init__(self, file_path: str):
        self.file_path = file_path

    def save_dictionary(self, services: List[ServiceEntity]) -> int:
        """
        Vuelca el dato final de cada servicio (su última iteración, ya sin conflictos
        pendientes) a la hoja Diccionario, sobrescribiéndola. La hoja Perímetro no se toca.
        Devuelve el número de servicios escritos.
        """
        rows = []
        for service in services:
            if not service.perimeter_iterations:
                continue
            if any(it.conflicts for it in service.perimeter_iterations):
                continue

            # Si el servicio fue cerrado ("Aceptar Cambios"), winning_data ya es el
            # resultado unificado con el maestro; si no, usamos la última iteración.
            final_data = service.winning_data if service.closed and service.winning_data else service.perimeter_iterations[-1].data
            rows.append(self._row_from_data(service.name, final_data))

        if not rows:
            return 0

        df = pd.DataFrame(rows, columns=DICTIONARY_COLUMNS)

        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Diccionario", index=False)

        return len(rows)

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
            "documento_origen": data.source_document,
            "version_doc": data.doc_version,
            "fiabilidad": data.reliability
        }
