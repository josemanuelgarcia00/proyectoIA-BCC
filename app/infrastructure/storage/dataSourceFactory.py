import os

from app.infrastructure.storage.excelReader import ExcelReader
from app.infrastructure.storage.excelWriter import ExcelWriter
from app.infrastructure.storage.googleSheetsReader import GoogleSheetsReader
from app.infrastructure.storage.googleSheetsWriter import GoogleSheetsWriter

DEFAULT_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "CARGA_SERVICIOS.xlsx")


def get_data_source() -> str:
    """'excel' (por defecto) o 'google_sheets', según la variable de entorno
    DATA_SOURCE. Mantener 'excel' como valor por defecto evita romper el
    comportamiento existente si alguien no ha configurado Google Sheets."""
    return os.environ.get("DATA_SOURCE", "excel").strip().lower()


def get_source_label() -> str:
    if get_data_source() == "google_sheets":
        return f"Google Sheets - {os.environ.get('GOOGLE_SHEET_ID', '')}"
    return f"Excel - {get_excel_path()}"


def get_excel_path() -> str:
    return os.path.abspath(os.environ.get("EXCEL_PATH", DEFAULT_EXCEL_PATH))


def _get_google_sheets_config() -> tuple:
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    credentials_path = os.environ.get("GOOGLE_SHEETS_CREDENTIALS_PATH", "credentials.json")
    if not sheet_id:
        raise ValueError(
            "DATA_SOURCE=google_sheets requiere la variable de entorno GOOGLE_SHEET_ID"
        )
    return sheet_id, credentials_path


def build_reader():
    """Crea el lector (Excel o Google Sheets) según DATA_SOURCE."""
    if get_data_source() == "google_sheets":
        sheet_id, credentials_path = _get_google_sheets_config()
        return GoogleSheetsReader(sheet_id, credentials_path)
    return ExcelReader(get_excel_path())


def build_writer():
    """Crea el escritor (Excel o Google Sheets) según DATA_SOURCE."""
    if get_data_source() == "google_sheets":
        sheet_id, credentials_path = _get_google_sheets_config()
        return GoogleSheetsWriter(sheet_id, credentials_path)
    return ExcelWriter(get_excel_path())
