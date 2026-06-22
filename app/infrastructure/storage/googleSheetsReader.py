import hashlib

from app.infrastructure.storage.sheetParser import SheetDataParser
from app.infrastructure.storage.googleSheetsClient import open_spreadsheet


class GoogleSheetsReader(SheetDataParser):
    """Misma interfaz que ExcelReader, pero leyendo las hojas 'Diccionario' y
    'Perímetro' desde un Google Sheet en vez de un archivo .xlsx local."""

    def __init__(self, sheet_id: str, credentials_path: str):
        self.sheet_id = sheet_id
        self.credentials_path = credentials_path

    def read_excel_sheets(self):
        spreadsheet = open_spreadsheet(self.sheet_id, self.credentials_path)

        try:
            dic_ws = spreadsheet.worksheet("Diccionario")
            per_ws = spreadsheet.worksheet("Perímetro")
        except Exception as exc:
            raise ValueError(
                "El Google Sheet debe contener las hojas 'Diccionario' y 'Perímetro'"
            ) from exc

        dictionary_records = self._clean_records(dic_ws.get_all_records())
        perimeter_records = self._clean_records(per_ws.get_all_records())

        return dictionary_records, perimeter_records

    def get_signature(self, dictionary_records=None, perimeter_records=None):
        """Google Sheets no expone una 'fecha de modificación' barata sin la
        API de Drive, así que la firma de cambio es un hash del contenido.
        Si quien llama ya leyó los registros (p.ej. justo después de
        read_excel_sheets()), se le pueden pasar aquí para no gastar otra
        llamada a la API solo para calcular la firma."""
        if dictionary_records is None or perimeter_records is None:
            dictionary_records, perimeter_records = self.read_excel_sheets()
        digest_input = repr(dictionary_records) + repr(perimeter_records)
        return hashlib.sha256(digest_input.encode("utf-8")).hexdigest()

    @staticmethod
    def _clean_records(records):
        """Normaliza nombres de columna (sin espacios) y deja cadena vacía
        donde get_all_records ya pone "" para celdas vacías."""
        cleaned = []
        for record in records:
            cleaned.append({str(k).strip(): v for k, v in record.items()})
        return cleaned
