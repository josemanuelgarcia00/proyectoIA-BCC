import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Autenticar (leer credentials.json + intercambiar el token OAuth) y abrir el
# Sheet por ID cuestan cada uno una llamada de red. Antes se repetían en cada
# lectura/escritura (una misma acción del usuario, p.ej. "Guardar en Excel",
# encadena varias), lo que multiplicaba la latencia percibida. Se cachea el
# handle por (sheet_id, credentials_path): es válido durante toda la vida del
# proceso porque las credenciales de cuenta de servicio renuevan su token de
# acceso solas (vía AuthorizedSession) y el Spreadsheet no queda obsoleto al
# crear/limpiar hojas, solo al cambiar de Sheet.
_spreadsheet_cache: dict = {}


def open_spreadsheet(sheet_id: str, credentials_path: str) -> gspread.Spreadsheet:
    """Abre el Google Sheet identificado por sheet_id usando una cuenta de
    servicio. El Sheet debe estar compartido (como Editor) con el email de esa
    cuenta de servicio, o gspread devolverá un error de permisos."""
    cache_key = (sheet_id, credentials_path)
    cached = _spreadsheet_cache.get(cache_key)
    if cached is not None:
        return cached

    credentials = Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
    client = gspread.authorize(credentials)
    spreadsheet = client.open_by_key(sheet_id)
    _spreadsheet_cache[cache_key] = spreadsheet
    return spreadsheet
