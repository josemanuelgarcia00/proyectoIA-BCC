import re
from typing import List, Dict, Tuple, Optional
from app.domain.service import (
    ServiceEntity, PerimeterIteration, ExcelRowData, CellConflict, has_new_content
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
        return self.extract_services_from_records(dictionary_records, perimeter_records)

    def extract_services_from_records(
        self, dictionary_records: List[Dict], perimeter_records: List[Dict]
    ) -> List[ServiceEntity]:
        """
        Igual que extract_services_from_perimeter, pero a partir de registros
        ya leídos. Evita una segunda lectura de la fuente (cara en Google
        Sheets, donde cada lectura es una llamada a la API) cuando quien
        llama ya leyó read_excel_sheets() por su cuenta.
        """
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
            has_conflicts = any(it.conflicts for it in iterations)
            # Si el servicio ya existía en el Diccionario y ninguna iteración
            # propone nada distinto, no hay ningún cambio que revisar ni
            # confirmar: se cierra solo, para que no aparezca como pendiente
            # (p.ej. en la zona de guardado) algo con lo que no hay que hacer
            # nada. Esto NO aplica a servicios nuevos (sin master_data): esos
            # sí requieren una decisión explícita del usuario para incorporarse.
            unchanged_existing = master_data is not None and not has_conflicts

            service = ServiceEntity(
                name=service_name,
                exists_in_dictionary="Si" if master_data else "No",
                consolidated_status="En revision" if has_conflicts else "Aceptado",
                winning_data=master_data,
                perimeter_iterations=iterations,
                closed=unchanged_existing
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
    # Variante sin "v": la versión viene solo entre paréntesis, p.ej.
    # "Documento.docx (2.0)" (sin el prefijo "v" delante del número).
    DOCUMENT_VERSION_PARENS_PATTERN = re.compile(r'^(.*\S)\s*\((\d+(?:\.\d+)*)\)\s*$')

    @classmethod
    def _split_document_version(cls, value: str) -> Tuple[str, str]:
        """Separa un valor combinado 'documento + versión' en sus dos partes.

        format_document_version (ver sheetRowFormat.py) siempre inserta un
        único separador literal " | " entre el bloque de documento(s) y el
        de versión(es), sin importar si cualquiera de los dos lados ya es en
        sí mismo una lista fusionada de varias iteraciones (p.ej.
        "DocA / DocB | v1.0 / 2.0"). Partir por ese separador es robusto ante
        eso. El regex de abajo (DOCUMENT_VERSION_PATTERN), en cambio, solo
        reconoce una única versión simple al final del texto: con más de un
        valor fusionado no encaja, y entonces el valor entero (documento +
        separador + versión) se devolvía como si fuera el documento,
        perdiendo la versión real. Se conserva solo como fallback para datos
        heredados que no usan "|" (formato antiguo "Documento - vX.Y")."""
        if not value:
            return "", ""

        value = value.strip()
        if " | " in value:
            doc_part, version_part = value.rsplit(" | ", 1)
            doc_part = doc_part.strip()
            if "|" in doc_part:
                # La parte del documento todavía tiene un "|" suelto: esto ya
                # venía corrompido de ANTES de este arreglo (una fusión previa
                # mezcló texto de documento y de versión sin separarlos bien).
                # Se reconstruye quedándose solo con los nombres de documento
                # únicos y descartando lo que en realidad es una versión.
                doc_part = cls._clean_corrupted_document(doc_part)
            return doc_part, cls._normalize_version(version_part)

        match = cls.DOCUMENT_VERSION_PATTERN.match(value) or cls.DOCUMENT_VERSION_PARENS_PATTERN.match(value)
        if not match:
            return value, ""

        return match.group(1).strip(" -|"), match.group(2)

    # Un token que es en realidad una versión suelta ("v2.0", "(1.1)", "2.0"),
    # útil para reconocer y descartar restos de versión que quedaron mezclados
    # con nombres de documento en datos ya corrompidos antes de este arreglo.
    _VERSION_TOKEN_PATTERN = re.compile(r'^\(?[vV]?\d+(?:\.\d+)*\)?$')

    @classmethod
    def _clean_corrupted_document(cls, doc_part: str) -> str:
        """
        Repara un valor de documento que ya venía corrompido (contiene "|"
        sueltos, señal de fusiones repetidas antes de que _split_document_version
        partiera bien la columna combinada): junta todos los fragmentos
        separados por "|" o " / ", descarta los que en realidad son una
        versión suelta, y elimina duplicados conservando el orden.

        No se puede recuperar el emparejamiento original documento-versión
        perdido en esa corrupción anterior, pero al menos evita seguir
        mostrando un bloque de texto gigante y repetido.
        """
        fragments = []
        for chunk in doc_part.split("|"):
            fragments.extend(p.strip() for p in chunk.split(" / "))

        seen = set()
        cleaned = []
        for fragment in fragments:
            if not fragment or cls._VERSION_TOKEN_PATTERN.match(fragment):
                continue
            if fragment not in seen:
                seen.add(fragment)
                cleaned.append(fragment)

        return " / ".join(cleaned)

    @classmethod
    def _normalize_version(cls, value: str) -> str:
        """
        Normaliza la versión a solo dígitos, sin importar si viene con el
        prefijo "v"/"V", entre paréntesis, o ambos a la vez ("v2.0", "(2.0)"
        y "(v2.0)" se normalizan igual). Si el valor es en sí mismo una
        lista ya fusionada de varias iteraciones (separada por " / "), cada
        parte se normaliza por separado, para no dejar un prefijo o
        paréntesis suelto a mitad de la lista.

        Sin esto, "v2.0" (tal cual puede venir en la columna de versión
        separada del Perímetro) y "2.0" (ya partido de la columna combinada
        del Diccionario) se verían como una versión nueva aunque sean la misma.
        """
        value = (value or "").strip()
        if not value:
            return ""

        if " / " in value:
            seen = set()
            parts = []
            for part in value.split(" / "):
                normalized = cls._normalize_version(part)
                if normalized and normalized not in seen:
                    seen.add(normalized)
                    parts.append(normalized)
            return " / ".join(parts)

        if value.startswith("(") and value.endswith(")"):
            value = value[1:-1].strip()

        if value[:1].lower() == "v":
            value = value[1:].strip()

        return value

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
        doc_version = self._normalize_version(doc_version)

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

            # Solo es un conflicto real si la propuesta aporta algo que la
            # línea base todavía no contempla (p.ej. si ya se unificaron "A"
            # y "B" y llega de nuevo "B" suelto, no hay nada nuevo que decidir).
            if has_new_content(current_value, base_value, attr_name):
                conflicts.append(CellConflict(
                    column=attr_name,
                    dictionary_base_value=str(base_value),
                    perimeter_new_proposal=str(current_value)
                ))

        # Documento de origen y versión siempre forman un par: si cualquiera de
        # los dos aporta contenido nuevo, se reporta como un único conflicto conjunto.
        doc_has_new = has_new_content(
            current_data.source_document, baseline_data.source_document, 'source_document'
        )
        version_has_new = has_new_content(
            current_data.doc_version, baseline_data.doc_version, 'doc_version'
        )
        if doc_has_new or version_has_new:
            base_doc = (baseline_data.source_document, baseline_data.doc_version)
            current_doc = (current_data.source_document, current_data.doc_version)
            conflicts.append(CellConflict(
                column='document',
                dictionary_base_value=f"{base_doc[0]} (v{base_doc[1]})",
                perimeter_new_proposal=f"{current_doc[0]} (v{current_doc[1]})"
            ))

        return conflicts
