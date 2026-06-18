import pandas as pd
import os
import re
from typing import List, Dict, Tuple
from app.domain.service import (
    ServiceEntity, PerimeterIteration, ExcelRowData, CellConflict
)


class ExcelReader:
    def __init__(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"No se encontró el archivo en: {file_path}")
        self.file_path = file_path

    def read_excel_sheets(self):
        """
        Lee el Excel, limpia los valores nulos y normaliza los nombres de las columnas.
        Retorna dos listas de diccionarios (Diccionario y Perímetro).
        """
        # Leemos el archivo
        xls = pd.ExcelFile(self.file_path)
        
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

    def extract_services_from_perimeter(self) -> List[ServiceEntity]:
        """
        Lee el perímetro y extrae servicios agrupados por nombre,
        detectando iteraciones (por números entre paréntesis) y conflictos.
        También cruza cada servicio con la hoja Diccionario para poblar
        sus datos maestros (winning_data / exists_in_dictionary).
        """
        dictionary_records, perimeter_records = self.read_excel_sheets()
        dictionary_index = self._build_dictionary_index(dictionary_records)

        if not perimeter_records:
            return []
        
        # Agrupar registros por nombre de servicio limpio
        services_map = {}  # {clean_name: [(raw_name, iteration_num, record), ...]}
        
        for record in perimeter_records:
            # Obtener el nombre del primer campo (normalmente la clave)
            raw_key = str(record.get(list(record.keys())[0], "")).strip()
            if not raw_key or raw_key.lower() == "nan":
                continue
            
            # Extraer número de iteración si existe (formato: "NOMBRE (2)")
            match = re.search(r'\s\((\d+)\)$', raw_key)
            iteration_num = int(match.group(1)) if match else 1
            
            # Limpiar nombre (remover el número de iteración)
            clean_name = re.sub(r'\s\(\d+\)$', '', raw_key).strip().upper()
            
            if clean_name not in services_map:
                services_map[clean_name] = []
            
            services_map[clean_name].append({
                'raw_name': raw_key,
                'iteration_num': iteration_num,
                'record': record
            })
        
        # Convertir a ServiceEntity
        services = []
        for service_name, entries in services_map.items():
            # Ordenar por número de iteración
            entries.sort(key=lambda x: x['iteration_num'])

            # Datos maestros del servicio (si existe en el Diccionario)
            master_data = dictionary_index.get(service_name)

            # Crear iteraciones
            iterations = []
            for idx, entry in enumerate(entries):
                iteration_id = idx + 1
                excel_row_data = self._record_to_excel_row_data(entry['record'])

                # Detectar conflictos comparando con iteraciones anteriores
                conflicts = self._detect_conflicts_with_previous(
                    excel_row_data,
                    iterations,
                    entry['record']
                )

                iteration = PerimeterIteration(
                    iteration_id=iteration_id,
                    data=excel_row_data,
                    conflicts=conflicts
                )
                iterations.append(iteration)

            # Crear ServiceEntity
            service = ServiceEntity(
                name=service_name,
                exists_in_dictionary="Si" if master_data else "No",
                consolidated_status="En revision" if any(
                    it.conflicts for it in iterations
                ) else "Aceptado",
                winning_data=master_data,
                perimeter_iterations=iterations
            )
            services.append(service)

        return services

    def _build_dictionary_index(self, dictionary_records: List[Dict]) -> Dict[str, ExcelRowData]:
        """
        Construye un índice {nombre_servicio: ExcelRowData} a partir de la hoja Diccionario.
        """
        index = {}
        for record in dictionary_records:
            raw_key = str(record.get(list(record.keys())[0], "")).strip()
            if not raw_key or raw_key.lower() == "nan":
                continue

            clean_name = re.sub(r'\s\(\d+\)$', '', raw_key).strip().upper()
            index[clean_name] = self._record_to_excel_row_data(record)

        return index

    def _record_to_excel_row_data(self, record: Dict) -> ExcelRowData:
        """
        Convierte un registro del Excel en un objeto ExcelRowData.
        Mapea columnas del Excel a campos del modelo.
        """
        # Mapeo flexible de columnas (case-insensitive)
        columns_lower = {k.lower().strip(): v for k, v in record.items()}
        
        def get_field(names_list, default=""):
            """Obtiene un campo buscando en múltiples nombres posibles"""
            for name in names_list:
                if name.lower().strip() in columns_lower:
                    value = columns_lower[name.lower().strip()]
                    return str(value).strip() if value else default
            return default
        
        def parse_list_field(names_list, default=None):
            """Parsea un campo de lista (separado por comas o ;)"""
            value = get_field(names_list, "")
            if not value:
                return default if default is not None else []
            # Dividir por comas o puntos y coma
            items = re.split(r'[,;]', value)
            return [item.strip() for item in items if item.strip()]
        
        return ExcelRowData(
            app=get_field(['app', 'aplicación', 'application'], ""),
            type=get_field(['type', 'tipo', 'resource_type'], ""),
            verb=get_field(['verb', 'verbo', 'http_method'], "GET"),
            scope=get_field(['scope', 'alcance', 'nivel', 'ambito', 'ámbito'], ""),
            functional_use=get_field(['functional_use', 'uso_funcional', 'description'], ""),
            inputs=parse_list_field(['inputs', 'parámetros_entrada', 'entrada', 'entradas'], []),
            outputs=parse_list_field(['outputs', 'parámetros_salida', 'salida', 'salidas'], []),
            invokes=parse_list_field(['invokes', 'invoca', 'llamadas'], []),
            reference_tables=parse_list_field(['reference_tables', 'tablas_referencia', 'tablas_referenciales'], []),
            source_document=get_field(['source_document', 'documento_origen', 'documento_origen | version_doc'], ""),
            doc_version=get_field(['doc_version', 'versión', 'version', 'version_doc'], "1.0.0"),
            reliability=get_field(['reliability', 'confiabilidad', 'fiabilidad'], "Media")
        )

    def _detect_conflicts_with_previous(
        self,
        current_data: ExcelRowData,
        previous_iterations: List[PerimeterIteration],
        current_record: Dict
    ) -> List[CellConflict]:
        """
        Detecta conflictos comparando la iteración actual con las anteriores.
        """
        if not previous_iterations:
            return []
        
        conflicts = []
        
        # Campos a comparar
        fields_to_check = [
            ('app', 'app'),
            ('type', 'type'),
            ('verb', 'verb'),
            ('scope', 'scope'),
            ('functional_use', 'functional_use'),
            ('inputs', 'inputs'),
            ('outputs', 'outputs'),
            ('invokes', 'invokes'),
            ('reference_tables', 'reference_tables'),
            ('source_document', 'source_document'),
            ('doc_version', 'doc_version'),
            ('reliability', 'reliability')
        ]
        
        # Comparar con la PRIMERA iteración (línea de base)
        first_iteration = previous_iterations[0]
        
        for field_name, attr_name in fields_to_check:
            current_value = getattr(current_data, attr_name)
            base_value = getattr(first_iteration.data, attr_name)
            
            # Normalizar para comparación
            if isinstance(current_value, list):
                current_value = sorted(current_value)
            if isinstance(base_value, list):
                base_value = sorted(base_value)
            
            # Si son diferentes, registrar conflicto
            if str(current_value) != str(base_value):
                conflicts.append(CellConflict(
                    column=field_name,
                    dictionary_base_value=str(base_value),
                    perimeter_new_proposal=str(current_value)
                ))
        
        return conflicts