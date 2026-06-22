from datetime import datetime
from typing import List, Dict, Iterable
import gspread
from app.infrastructure.storage.googleSheetsClient import open_spreadsheet
from app.infrastructure.storage.googleSheetsReader import GoogleSheetsReader

SHEET_NAME = "Auditoria"
COLUMNS = ["fecha_hora", "servicio", "iteracion", "accion", "valor", "snapshot"]


class GoogleSheetsAuditLog:
    """Misma interfaz que ExcelAuditLog, pero leyendo/escribiendo la hoja
    'Auditoria' directamente en el Google Sheet, para sesiones que trabajan
    en modo DATA_SOURCE=google_sheets sin depender del Excel físico local."""

    def __init__(self, sheet_id: str, credentials_path: str):
        self.sheet_id = sheet_id
        self.credentials_path = credentials_path

    def append(self, servicio: str, accion: str, valor: str = "", iteracion: str = "", snapshot: str = "") -> None:
        entries = self.read_all()
        entries.append({
            "fecha_hora": datetime.now().isoformat(timespec="seconds"),
            "servicio": servicio,
            "iteracion": str(iteracion) if iteracion != "" else "",
            "accion": accion,
            "valor": valor or "",
            "snapshot": snapshot or "",
        })
        self._write_all(entries)

    def remove_for_services(self, servicios: Iterable[str]) -> None:
        """Borra del historial las entradas de los servicios indicados (ver
        ExcelAuditLog.remove_for_services para el motivo)."""
        names = {str(s).upper() for s in servicios}
        if not names:
            return

        current = self.read_all()
        entries = [e for e in current if str(e.get("servicio", "")).upper() not in names]
        if len(entries) == len(current):
            return  # Nada que borrar

        self._write_all(entries)

    def read_all(self) -> List[Dict]:
        """Devuelve todas las entradas registradas, en el mismo orden en que
        se escribieron (orden cronológico)."""
        spreadsheet = open_spreadsheet(self.sheet_id, self.credentials_path)
        try:
            worksheet = spreadsheet.worksheet(SHEET_NAME)
        except gspread.WorksheetNotFound:
            return []

        return GoogleSheetsReader._clean_records(worksheet.get_all_records())

    def _write_all(self, entries: List[Dict]) -> None:
        spreadsheet = open_spreadsheet(self.sheet_id, self.credentials_path)
        try:
            worksheet = spreadsheet.worksheet(SHEET_NAME)
            worksheet.clear()
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=SHEET_NAME, rows=1, cols=len(COLUMNS))

        values = [COLUMNS] + [[str(e.get(col, "")) for col in COLUMNS] for e in entries]
        worksheet.update(values)
