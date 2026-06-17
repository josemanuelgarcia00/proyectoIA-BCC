import pandas as pd 
from app.domain.service import ExcelRowData, PerimeterIteration, CellConflict, ServiceDocument

class ComparatorService:
    def reconcile(self, dictionary_rows, perimeter_rows) -> list[ServiceDocument]:
        
        # Función auxiliar para limpiar y normalizar textos
        def clean(val): return str(val).strip() if pd.notna(val) else ""
        
        # 1. Crear el índice maestro (Diccionario)
        master_services = {}
        for row in dictionary_rows:
            name = clean(row.get('servicio')).upper()
            master_services[name] = ExcelRowData(
                app=clean(row.get('app')), type=clean(row.get('tipo')), verb=clean(row.get('verbo')),
                scope=clean(row.get('ambito')), functional_use=clean(row.get('uso_funcional')),
                inputs=self._parse_list(row.get('entradas')), outputs=self._parse_list(row.get('salidas')),
                invokes=self._parse_list(row.get('invoca')), reference_tables=self._parse_list(row.get('tablas_referenciales')),
                source_document=clean(row.get('documento_origen')), doc_version=clean(str(row.get('version_doc'))),
                reliability=clean(row.get('fiabilidad'))
            )

        # 2. Procesar el Perímetro y detectar discrepancias
        final_docs = {}
        for row in perimeter_rows:
            name = clean(row.get('servicio')).upper()
            
            # Inicializar documento si es nuevo
            if name not in final_docs:
                is_in_dict = name in master_services
                final_docs[name] = ServiceDocument(
                    _id=name,
                    exists_in_dictionary="Si" if is_in_dict else "No",
                    consolidated_status="Aceptado" if is_in_dict else "En revision",
                    winning_data=master_services.get(name),
                    perimeter_iterations=[]
                )

            # Crear datos de la iteración
            iter_data = ExcelRowData(
                app=clean(row.get('app')), type=clean(row.get('tipo')), verb=clean(row.get('verbo')),
                scope=clean(row.get('ambito')), functional_use=clean(row.get('uso_funcional')),
                inputs=self._parse_list(row.get('entradas')), outputs=self._parse_list(row.get('salidas')),
                invokes=self._parse_list(row.get('invoca')), reference_tables=self._parse_list(row.get('tablas_referenciales')),
                source_document=clean(row.get('documento_origen')), doc_version=clean(str(row.get('version_doc'))),
                reliability=clean(row.get('fiabilidad'))
            )

            # 3. Comparar valores y generar conflictos (si el servicio existe en el maestro)
            conflicts = []
            master = final_docs[name].winning_data
            if master:
                for field in ["app", "type", "verb", "scope"]:
                    if str(getattr(master, field)) != str(getattr(iter_data, field)):
                        conflicts.append(CellConflict(
                            column=field,
                            dictionary_base_value=str(getattr(master, field)),
                            perimeter_new_proposal=str(getattr(iter_data, field))
                        ))

            # Añadir a la lista de iteraciones
            iteration = PerimeterIteration(
                iteration_id=len(final_docs[name].perimeter_iterations) + 1,
                data=iter_data,
                conflicts=conflicts
            )
            final_docs[name].perimeter_iterations.append(iteration)

        return list(final_docs.values())

    def _parse_list(self, val):
        import pandas as pd
        if pd.isna(val) or str(val).lower() == 'n/d': return []
        return [x.strip() for x in str(val).split(';') if x.strip()]