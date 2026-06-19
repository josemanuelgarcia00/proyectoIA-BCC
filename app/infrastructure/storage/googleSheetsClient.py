import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]


def open_spreadsheet(sheet_id: str, credentials_path: str) -> gspread.Spreadsheet:
    """Abre el Google Sheet identificado por sheet_id usando una cuenta de
    servicio. El Sheet debe estar compartido (como Editor) con el email de esa
    cuenta de servicio, o gspread devolverá un error de permisos."""
    credentials = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
    client = gspread.authorize(credentials)
    return client.open_by_key(sheet_id)
