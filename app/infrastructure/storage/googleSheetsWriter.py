import re
from typing import List
import gspread
from app.domain.service import ServiceEntity
from app.infrastructure.storage.googleSheetsClient import open_spreadsheet
from app.infrastructure.storage.googleSheetsReader import GoogleSheetsReader
from app.infrastructure.storage.sheetParser import SheetDataParser
from app.infrastructure.storage.sheetRowFormat import (
    DICTIONARY_COLUMNS, REJECTED_COLUMNS, row_from_data, merge_observations
)


class GoogleSheetsWriter:
    """Misma interfaz que ExcelWriter, pero leyendo/escribiendo las hojas
    'Diccionario' y 'Desechados' directamente en un Google Sheet."""

    def __init__(self, sheet_id: str, credentials_path: str):
        self.sheet_id = sheet_id
        self.credentials_path = credentials_path
        self._parser = SheetDataParser()

    def save_dictionary(self, services: List[ServiceEntity]) -> int:
        rows_by_service = self._read_existing_dictionary()

        upserted = 0
        for service in services:
            if service.consolidated_status == "Desechado":
                continue
            if not service.perimeter_iterations:
                continue
            if any(it.conflicts for it in service.perimeter_iterations):
                continue

            final_data = service.winning_data if service.closed and service.winning_data else service.perimeter_iterations[-1].data
            rows_by_service[service.name] = row_from_data(service.name, final_data)
            upserted += 1

        if upserted == 0:
            return 0

        self._write_sheet("Diccionario", DICTIONARY_COLUMNS, rows_by_service.values())
        return upserted

    def save_rejected(self, services: List[ServiceEntity]) -> int:
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

        self._write_sheet("Desechados", REJECTED_COLUMNS, rows_by_service.values())
        return len(rejected)

    def _read_existing_dictionary(self) -> dict:
        try:
            reader = GoogleSheetsReader(self.sheet_id, self.credentials_path)
            dictionary_records, _ = reader.read_excel_sheets()
        except ValueError:
            return {}

        existing = {}
        for record in dictionary_records:
            raw_key = str(record.get(list(record.keys())[0], "")).strip()
            if not raw_key or raw_key.lower() == "nan":
                continue

            service_name = re.sub(r'\s\(\d+\)$', '', raw_key).strip().upper()
            row_data = self._parser._record_to_excel_row_data(record)
            existing[service_name] = row_from_data(service_name, row_data)

        return existing

    def _read_existing_rejected(self) -> dict:
        spreadsheet = open_spreadsheet(self.sheet_id, self.credentials_path)
        try:
            worksheet = spreadsheet.worksheet("Desechados")
        except gspread.WorksheetNotFound:
            return {}

        records = GoogleSheetsReader._clean_records(worksheet.get_all_records())

        existing = {}
        for record in records:
            name = str(record.get("servicio", "")).strip().upper()
            if not name:
                continue
            existing[name] = {col: record.get(col, "") for col in REJECTED_COLUMNS}

        return existing

    def _write_sheet(self, sheet_name: str, columns: List[str], rows) -> None:
        spreadsheet = open_spreadsheet(self.sheet_id, self.credentials_path)
        try:
            worksheet = spreadsheet.worksheet(sheet_name)
            worksheet.clear()
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=sheet_name, rows=1, cols=len(columns))

        values = [columns] + [[row.get(col, "") for col in columns] for row in rows]
        worksheet.update(values)
