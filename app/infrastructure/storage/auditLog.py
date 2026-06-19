from datetime import datetime
from typing import List, Dict
import pandas as pd

SHEET_NAME = "Auditoria"
COLUMNS = ["fecha_hora", "servicio", "iteracion", "accion", "valor"]


class ExcelAuditLog:
    """Registro de decisiones (append-only) en la hoja 'Auditoria' del Excel
    de origen. Es la fuente de verdad de las decisiones tomadas: en vez de
    confiar solo en la caché en memoria del catálogo (que se pierde si el
    servidor se reinicia), cada decisión se escribe aquí en el momento en que
    se toma, y CatalogRepository la reproduce (replay) al cargar el catálogo
    para reconstruir el mismo estado.

    Por ahora solo existe esta variante para el archivo Excel local; cuando
    haya acceso a la API de Google Sheets se podrá añadir el equivalente para
    esa fuente."""

    def __init__(self, file_path: str):
        self.file_path = file_path

    def append(self, servicio: str, accion: str, valor: str = "", iteracion: str = "") -> None:
        entries = self.read_all()
        entries.append({
            "fecha_hora": datetime.now().isoformat(timespec="seconds"),
            "servicio": servicio,
            "iteracion": str(iteracion) if iteracion != "" else "",
            "accion": accion,
            "valor": valor or "",
        })

        df = pd.DataFrame(entries, columns=COLUMNS)
        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name=SHEET_NAME, index=False)

    def read_all(self) -> List[Dict]:
        """Devuelve todas las entradas registradas, en el mismo orden en que
        se escribieron (orden cronológico), necesario para reproducirlas
        fielmente."""
        try:
            with pd.ExcelFile(self.file_path) as xls:
                if SHEET_NAME not in xls.sheet_names:
                    return []
                df = pd.read_excel(xls, sheet_name=SHEET_NAME)
        except FileNotFoundError:
            return []

        df.columns = df.columns.str.strip()
        df = df.fillna("")
        return df.to_dict("records")
