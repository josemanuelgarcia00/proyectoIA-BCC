import pandas as pd
import os
from app.infrastructure.storage.sheetParser import SheetDataParser


class ExcelReader(SheetDataParser):
    def __init__(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"No se encontró el archivo en: {file_path}")
        self.file_path = file_path

    def read_excel_sheets(self):
        """
        Lee el Excel, limpia los valores nulos y normaliza los nombres de las columnas.
        Retorna dos listas de diccionarios (Diccionario y Perímetro).
        """
        # Leemos el archivo. Usamos un context manager para cerrar el fichero en
        # cuanto terminamos de leerlo (no dejar el handle abierto más de lo
        # necesario evita conflictos si alguien tiene el Excel abierto a la vez
        # en la aplicación de escritorio).
        with pd.ExcelFile(self.file_path) as xls:
            # Validamos que las hojas existan
            if 'Diccionario' not in xls.sheet_names or 'Perímetro' not in xls.sheet_names:
                raise ValueError("El Excel debe contener las hojas 'Diccionario' y 'Perímetro'")

            # Leemos hojas
            dic_df = pd.read_excel(xls, sheet_name='Diccionario')
            per_df = pd.read_excel(xls, sheet_name='Perímetro')

        # Limpieza: Eliminamos espacios en blanco en nombres de columnas
        dic_df.columns = dic_df.columns.str.strip()
        per_df.columns = per_df.columns.str.strip()

        # Limpieza: Convertimos NaNs a strings vacíos para que el dominio no sufra
        dic_df = dic_df.fillna("")
        per_df = per_df.fillna("")

        # Convertimos a formato lista de diccionarios
        return dic_df.to_dict('records'), per_df.to_dict('records')

    def get_signature(self):
        """Firma barata para detectar cambios sin releer ni parsear el archivo
        (la fecha de modificación del archivo en disco)."""
        return os.path.getmtime(self.file_path)
