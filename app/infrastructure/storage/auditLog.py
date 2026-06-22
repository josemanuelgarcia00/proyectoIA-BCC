from datetime import datetime
from typing import List, Dict, Iterable
import pandas as pd

SHEET_NAME = "Auditoria"
COLUMNS = ["fecha_hora", "servicio", "iteracion", "accion", "valor", "snapshot"]


class ExcelAuditLog:
    """Registro de decisiones (append-only) en la hoja 'Auditoria' del Excel
    de origen. Es la fuente de verdad de las decisiones tomadas: en vez de
    confiar solo en la caché en memoria del catálogo (que se pierde si el
    servidor se reinicia), cada decisión se escribe aquí en el momento en que
    se toma, y CatalogRepository la reproduce al cargar el catálogo para
    reconstruir el mismo estado.

    'accion'/'valor' son para que el historial sea legible por una persona
    (qué se hizo). La restauración real no recalcula nada a partir de ellos:
    usa 'snapshot', un JSON con el estado completo y ya resuelto del servicio
    justo después de aplicar la decisión, para que lo restaurado sea
    exactamente lo que se aceptó, sin depender de volver a aplicar la lógica
    de resolución de conflictos sobre los datos de origen (que podrían haber
    cambiado entre medias).

    Variante para el archivo Excel local; ver GoogleSheetsAuditLog para la
    misma interfaz sobre Google Sheets (la fuente activa la elige
    dataSourceFactory.build_audit_log() según DATA_SOURCE)."""

    def __init__(self, file_path: str):
        self.file_path = file_path

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

        df = pd.DataFrame(entries, columns=COLUMNS)
        with pd.ExcelWriter(self.file_path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
            df.to_excel(writer, sheet_name=SHEET_NAME, index=False)

    def remove_for_services(self, servicios: Iterable[str]) -> None:
        """
        Borra del historial las entradas de los servicios indicados. Se usa
        cuando un servicio ya se volcó a la hoja Diccionario/Desechados: su
        dato final ya quedó fijado ahí, así que no hace falta seguir
        reproduciendo su historial de decisiones en cada carga.

        Nota: esto solo evita que reaparezca mientras la caché en memoria no
        se recargue desde cero (ver CatalogRepository.remove_from_cache). Si
        el servidor se reinicia, sus filas en Perímetro se volverán a comparar
        contra el Diccionario sin el historial que las resolvía.
        """
        names = {str(s).upper() for s in servicios}
        if not names:
            return

        current = self.read_all()
        entries = [e for e in current if str(e.get("servicio", "")).upper() not in names]
        if len(entries) == len(current):
            return  # Nada que borrar (ninguno tenía entradas en la auditoría)

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
