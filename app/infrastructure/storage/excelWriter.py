import re
from datetime import datetime
import pandas as pd
from typing import List
from app.domain.service import ServiceEntity
from app.infrastructure.storage.excelReader import ExcelReader
from app.infrastructure.storage.sheetRowFormat import (
    DICTIONARY_COLUMNS, REJECTED_COLUMNS, row_from_data, merge_observations
)

PERIMETER_HISTORY_SHEET = "Perímetro_Historico"
PERIMETER_SHEET = "Perímetro"


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
            if not service.closed:
                # Sin conflictos no implica "decidido": un servicio nuevo o sin
                # cambios puede quedar en "Aceptado" por defecto sin que el
                # usuario lo haya confirmado explícitamente (aceptar/rechazar).
                # Solo se guarda lo que de verdad se cerró.
                continue

            # Si el servicio fue cerrado ("Aceptar Cambios"), winning_data ya es el
            # resultado unificado con el maestro; si no, usamos la última iteración.
            final_data = service.winning_data if service.closed and service.winning_data else service.perimeter_iterations[-1].data
            rows_by_service[service.name] = row_from_data(service.name, final_data)
            upserted += 1

        if upserted == 0:
            return 0

        df = pd.DataFrame(rows_by_service.values(), columns=DICTIONARY_COLUMNS)

        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Diccionario", index=False)

        return upserted

    def save_rejected(self, services: List[ServiceEntity]) -> int:
        """
        Hace un upsert de cada servicio rechazado sobre la hoja Desechados: si el
        servicio ya estaba desechado de una sesión anterior, se unifica en la
        misma fila (se actualizan los datos y se acumulan las observaciones) en
        vez de duplicarlo. Devuelve el número de servicios rechazados escritos.
        """
        rejected = [s for s in services if s.consolidated_status == "Desechado"]
        if not rejected:
            return 0

        rows_by_service = self._read_existing_rejected()

        for service in rejected:
            iteration = service.perimeter_iterations[-1] if service.perimeter_iterations else None
            data = iteration.data if iteration else service.winning_data
            if data is None:
                continue

            previous_observations = rows_by_service.get(service.name, {}).get("observaciones", "")
            row = row_from_data(service.name, data)
            row["observaciones"] = merge_observations(
                previous_observations, iteration.observations if iteration else ""
            )
            rows_by_service[service.name] = row

        df = pd.DataFrame(rows_by_service.values(), columns=REJECTED_COLUMNS)

        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name="Desechados", index=False)

        return len(rejected)

    def archive_perimeter_rows(self, service_names: List[str]) -> int:
        """
        Mueve las filas del Perímetro de los servicios indicados a la hoja
        'Perímetro_Historico' (no se borran, se conservan tal cual se
        propusieron, con la fecha de archivado). Una vez que el dato final de
        un servicio ya quedó fijado en Diccionario/Desechados, sus filas de
        Perímetro ya cumplieron su función: sacarlas de la hoja activa evita
        que se vuelvan a comparar contra el Diccionario en cada carga (y, a
        diferencia de solo limpiar la caché en memoria, esto es permanente:
        aunque el servidor se reinicie, no reaparecen).
        Devuelve el número de filas archivadas.
        """
        names = {n.upper() for n in service_names}
        if not names:
            return 0

        try:
            with pd.ExcelFile(self.file_path) as xls:
                if PERIMETER_SHEET not in xls.sheet_names:
                    return 0
                per_df = pd.read_excel(xls, sheet_name=PERIMETER_SHEET)
        except FileNotFoundError:
            return 0

        per_df.columns = per_df.columns.str.strip()
        per_df = per_df.fillna("")
        if per_df.empty:
            return 0

        key_col = per_df.columns[0]

        def clean_name(raw) -> str:
            return re.sub(r'\s\(\d+\)$', '', str(raw).strip()).strip().upper()

        is_archived = per_df[key_col].apply(lambda v: clean_name(v) in names)
        to_archive = per_df[is_archived].copy()
        to_keep = per_df[~is_archived]

        if to_archive.empty:
            return 0

        to_archive["fecha_archivado"] = datetime.now().isoformat(timespec="seconds")

        existing_history = self._read_perimeter_history()
        combined_history = (
            pd.concat([existing_history, to_archive], ignore_index=True)
            if existing_history is not None else to_archive
        )

        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            to_keep.to_excel(writer, sheet_name=PERIMETER_SHEET, index=False)
            combined_history.to_excel(writer, sheet_name=PERIMETER_HISTORY_SHEET, index=False)

        return len(to_archive)

    def _read_perimeter_history(self):
        try:
            with pd.ExcelFile(self.file_path) as xls:
                if PERIMETER_HISTORY_SHEET not in xls.sheet_names:
                    return None
                df = pd.read_excel(xls, sheet_name=PERIMETER_HISTORY_SHEET)
        except FileNotFoundError:
            return None

        df.columns = df.columns.str.strip()
        return df.fillna("")

    def _read_existing_rejected(self) -> dict:
        """
        Lee la hoja Desechados actual (si existe) y la indexa por nombre de
        servicio, para poder unificar rechazos repetidos del mismo servicio en
        vez de duplicar filas.
        """
        try:
            with pd.ExcelFile(self.file_path) as xls:
                if "Desechados" not in xls.sheet_names:
                    return {}
                df = pd.read_excel(xls, sheet_name="Desechados")
        except FileNotFoundError:
            return {}

        df.columns = df.columns.str.strip()
        df = df.fillna("")

        existing = {}
        for record in df.to_dict("records"):
            name = str(record.get("servicio", "")).strip().upper()
            if not name:
                continue
            existing[name] = {col: record.get(col, "") for col in REJECTED_COLUMNS}

        return existing

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
            existing[service_name] = row_from_data(service_name, row_data)

        return existing
