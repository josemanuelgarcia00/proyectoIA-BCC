import re
from typing import List, Dict, Tuple, Optional
from app.domain.service import (
    ServiceEntity, PerimeterIteration, ExcelRowData, CellConflict
)


class SheetDataParser:
    """Lógica de parseo compartida entre fuentes de datos (Excel local, Google
    Sheets, ...). Las subclases solo necesitan implementar read_excel_sheets()
    devolviendo (registros_diccionario, registros_perimetro) como listas de
    diccionarios; todo lo demás (agrupar por servicio, detectar conflictos,
    mapear columnas) es independiente del origen de los datos."""

    def read_excel_sheets(self) -> Tuple[List[Dict], List[Dict]]:
        raise NotImplementedError

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

                # La línea base de comparación es en cascada: la 1ª iteración se
                # compara contra el Diccionario final (maestro); cada iteración
                # siguiente se compara contra la inmediatamente anterior.
                baseline_data = master_data if idx == 0 else iterations[idx - 1].data
                conflicts = self._detect_conflicts(excel_row_data, baseline_data)

                iteration = PerimeterIteration(
                    iteration_id=iteration_id,
                    data=excel_row_data,
                    conflicts=conflicts,
                    original_data=excel_row_data.model_copy(deep=True),
                    original_conflicts=[c.model_copy(deep=True) for c in conflicts]
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

    # Columna única que representa el par documento de origen + versión, p.ej.
    # "AF_Solicitud - Datos del contrato - v1.2.6.docx | v2.0". Separador entre
    # nombre de documento y versión: " | ", " - " o solo espacios, todos con "v"
    # delante del número de versión (caso real observado en el Diccionario).
    DOCUMENT_VERSION_PATTERN = re.compile(r'^(.*\S)\s*[-(|]?\s*[vV](\d+(?:\.\d+)*)\)?\s*$')

    @classmethod
    def _split_document_version(cls, value: str) -> Tuple[str, str]:
        """Separa un valor combinado 'documento + versión' en sus dos partes.
        Si no se reconoce el patrón (p.ej. valores ya fusionados de varias
        iteraciones sin versión al final), se devuelve el valor entero como
        documento y la versión vacía."""
        if not value:
            return "", ""

        match = cls.DOCUMENT_VERSION_PATTERN.match(value.strip())
        if not match:
            return value.strip(), ""

        return match.group(1).strip(" -|"), match.group(2)

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

        # El Diccionario ahora representa documento de origen y versión como un
        # único par en una sola columna ("documento_origen | version"). Seguimos
        # aceptando las dos columnas separadas como fallback por si el Excel
        # todavía no se migró.
        combined_doc = get_field(['documento_origen | version', 'documento_origen|version', 'source_document'], "")
        source_document, doc_version = self._split_document_version(combined_doc)
        if not source_document:
            source_document = get_field(['documento_origen'], "")
        if not doc_version:
            doc_version = get_field(['doc_version', 'versión', 'version', 'version_doc'], "1.0.0")

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
            source_document=source_document,
            doc_version=doc_version,
            reliability=get_field(['reliability', 'confiabilidad', 'fiabilidad'], "Media")
        )

    def _detect_conflicts(
        self,
        current_data: ExcelRowData,
        baseline_data: Optional[ExcelRowData]
    ) -> List[CellConflict]:
        """
        Detecta conflictos comparando los datos actuales contra una línea base
        (el Diccionario final para la 1ª iteración, o la iteración anterior para
        el resto). Si no hay línea base (servicio nuevo, no está en el Diccionario),
        no hay nada con qué comparar y por tanto no se detectan conflictos.
        """
        if baseline_data is None:
            return []

        conflicts = []

        # Campos a comparar de forma individual (documento y versión se tratan
        # aparte, como un único par, ver más abajo)
        fields_to_check = [
            'app', 'type', 'verb', 'scope', 'functional_use',
            'inputs', 'outputs', 'invokes', 'reference_tables',
            'reliability'
        ]

        for attr_name in fields_to_check:
            current_value = getattr(current_data, attr_name)
            base_value = getattr(baseline_data, attr_name)

            # Normalizar para comparación
            current_value_cmp = sorted(current_value) if isinstance(current_value, list) else current_value
            base_value_cmp = sorted(base_value) if isinstance(base_value, list) else base_value

            # Si son diferentes, registrar conflicto
            if str(current_value_cmp) != str(base_value_cmp):
                conflicts.append(CellConflict(
                    column=attr_name,
                    dictionary_base_value=str(base_value),
                    perimeter_new_proposal=str(current_value)
                ))

        # Documento de origen y versión siempre forman un par: si cualquiera de
        # los dos cambia, se reporta como un único conflicto conjunto.
        current_doc = (current_data.source_document, current_data.doc_version)
        base_doc = (baseline_data.source_document, baseline_data.doc_version)
        if current_doc != base_doc:
            conflicts.append(CellConflict(
                column='document',
                dictionary_base_value=f"{base_doc[0]} (v{base_doc[1]})",
                perimeter_new_proposal=f"{current_doc[0]} (v{current_doc[1]})"
            ))

        return conflicts
