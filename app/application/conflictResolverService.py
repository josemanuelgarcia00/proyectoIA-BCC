"""
MOTOR DE RESOLUCIÓN DE CONFLICTOS
Implementa la lógica de decisiones basada en iteraciones múltiples
"""
from typing import List, Optional, Dict, Tuple
from app.domain.service import ServiceEntity, PerimeterIteration, ExcelRowData, CellConflict

# Campos del modelo que se representan como listas (la unificación hace un merge/unión)
LIST_FIELDS = {"inputs", "outputs", "invokes", "reference_tables"}


class ConflictResolver:
    """Resuelve conflictos entre iteraciones del perímetro"""

    @staticmethod
    def _merge_values(previous_value, current_value, field_name: str):
        """Combina el valor anterior y la nueva propuesta en lugar de elegir uno solo"""
        if field_name in LIST_FIELDS:
            merged = list(previous_value) if previous_value else []
            for item in (current_value or []):
                if item not in merged:
                    merged.append(item)
            return merged

        previous_value = previous_value or ""
        current_value = current_value or ""
        if not previous_value:
            return current_value
        if not current_value or current_value == previous_value:
            return previous_value
        return f"{previous_value} / {current_value}"

    @staticmethod
    def resolve_iteration(
        service: ServiceEntity,
        iteration_id: int,
        resolution: str = "unify"
    ) -> Optional[PerimeterIteration]:
        """
        Resuelve TODOS los conflictos de una iteración contra su línea base en cascada
        (la 1ª iteración se compara con el Diccionario final/winning_data; el resto,
        con la iteración inmediatamente anterior, que puede ya incluir uniones previas):
        - "unify": une ambos valores (listas por unión, texto concatenado si difieren).
          No se elimina ni se sobrescribe nada.
        - "reject": descarta la nueva propuesta de esta iteración y mantiene la línea
          base. El dato original sigue recuperable con "volver atrás" en cualquier momento.
        Devuelve la iteración afectada, o None si no existe.
        """
        iterations = service.perimeter_iterations
        idx = next(
            (i for i, it in enumerate(iterations) if it.iteration_id == iteration_id),
            None
        )
        if idx is None:
            return None

        iteration = iterations[idx]
        baseline_data = iterations[idx - 1].data if idx > 0 else service.winning_data

        for conflict in iteration.conflicts:
            if conflict.column == "document":
                # Documento de origen y versión siempre van juntos como un par
                if resolution == "reject" and baseline_data:
                    iteration.data.source_document = baseline_data.source_document
                    iteration.data.doc_version = baseline_data.doc_version
                elif resolution != "reject":
                    base_doc = baseline_data.source_document if baseline_data else iteration.data.source_document
                    base_version = baseline_data.doc_version if baseline_data else iteration.data.doc_version
                    iteration.data.source_document = ConflictResolver._merge_values(
                        base_doc, iteration.data.source_document, "source_document"
                    )
                    iteration.data.doc_version = ConflictResolver._merge_values(
                        base_version, iteration.data.doc_version, "doc_version"
                    )
                continue

            current_value = getattr(iteration.data, conflict.column)
            baseline_value = getattr(baseline_data, conflict.column) if baseline_data else current_value

            if resolution == "reject":
                setattr(iteration.data, conflict.column, baseline_value)
            else:
                merged = ConflictResolver._merge_values(baseline_value, current_value, conflict.column)
                setattr(iteration.data, conflict.column, merged)

        iteration.conflicts = []
        iteration.resolution = resolution
        service.consolidated_status = ConflictResolver._compute_status(service)
        return iteration

    @staticmethod
    def _compute_status(service: ServiceEntity) -> str:
        """
        "Aceptado"/"Unificado" solo se asignan cuando el servicio está realmente
        cerrado (closed=True, tras "Aceptar cambios" en accept_and_close). Si ya
        no quedan conflictos pero el usuario todavía no ha confirmado el cierre,
        el servicio sigue "En revision": de lo contrario la etiqueta anunciaría
        una decisión que el usuario aún no ha tomado.
        """
        if any(it.conflicts for it in service.perimeter_iterations):
            return "En revision"
        if not service.closed:
            return "En revision"
        if any(it.resolution == "unify" for it in service.perimeter_iterations):
            return "Unificado"
        return "Aceptado"

    @staticmethod
    def revert_iteration(service: ServiceEntity, iteration_id: int) -> Optional[PerimeterIteration]:
        """
        Vuelve atrás la resolución aplicada a una iteración concreta, restaurando
        su estado original (datos y conflictos) tal y como se leyó del Excel.
        """
        iteration = next(
            (it for it in service.perimeter_iterations if it.iteration_id == iteration_id),
            None
        )
        if not iteration or iteration.original_data is None:
            return None

        iteration.data = iteration.original_data.model_copy(deep=True)
        iteration.conflicts = [c.model_copy(deep=True) for c in iteration.original_conflicts]
        iteration.resolution = None

        service.closed = False
        service.consolidated_status = ConflictResolver._compute_status(service)
        return iteration

    @staticmethod
    def reset_service(service: ServiceEntity) -> ServiceEntity:
        """Reinicia TODAS las iteraciones del servicio a su estado original (deshace toda la revisión)"""
        for iteration in service.perimeter_iterations:
            if iteration.original_data is not None:
                iteration.data = iteration.original_data.model_copy(deep=True)
                iteration.conflicts = [c.model_copy(deep=True) for c in iteration.original_conflicts]
                iteration.resolution = None

        service.closed = False
        service.consolidated_status = ConflictResolver._compute_status(service)
        return service

    @staticmethod
    def reject_service(service: ServiceEntity) -> ServiceEntity:
        """
        Rechaza el servicio por completo (p.ej. un servicio nuevo que no se quiere
        incorporar al Diccionario). No se borra ningún dato, solo se marca como
        descartado y se cierra para que deje de aparecer entre los pendientes.
        """
        service.closed = True
        service.consolidated_status = "Desechado"
        return service

    @staticmethod
    def revert_rejection(service: ServiceEntity) -> ServiceEntity:
        """
        Deshace el rechazo de un servicio y lo devuelve a la zona de revisión:
        reabre el servicio y recalcula su estado según los conflictos pendientes
        que le queden (o "En revision" si ya no tiene ninguno).
        """
        service.closed = False
        service.consolidated_status = ConflictResolver._compute_status(service)
        return service

    @staticmethod
    def preview_final_merge(service: ServiceEntity) -> Optional[ExcelRowData]:
        """
        Calcula (sin aplicar nada) cómo quedaría el dato final para el Diccionario:
        une la última iteración ya revisada con el dato maestro actual del
        Diccionario (winning_data), igual que hace "Unificar" en cada conflicto,
        para garantizar que nada de lo ya existente en el Diccionario se pierde.
        Devuelve None si todavía quedan conflictos pendientes o no hay iteraciones.
        """
        if any(it.conflicts for it in service.perimeter_iterations):
            return None
        if not service.perimeter_iterations:
            return None

        final_data = service.perimeter_iterations[-1].data
        master_data = service.winning_data

        if master_data is None:
            return final_data.model_copy(deep=True)

        merged_fields = {
            field: ConflictResolver._merge_values(
                getattr(master_data, field), getattr(final_data, field), field
            )
            for field in ExcelRowData.model_fields
        }
        return ExcelRowData(**merged_fields)

    @staticmethod
    def accept_and_close(service: ServiceEntity) -> Optional[ServiceEntity]:
        """
        Cierra el servicio: une el resultado final de la revisión con el dato
        maestro del Diccionario y lo fija como definitivo.
        Devuelve None si todavía quedan conflictos pendientes.
        """
        merged = ConflictResolver.preview_final_merge(service)
        if merged is None:
            return None

        service.winning_data = merged
        service.exists_in_dictionary = "Si"
        service.closed = True
        service.consolidated_status = "Cerrado"
        return service

    @staticmethod
    def resolve_iterations(service: ServiceEntity) -> Tuple[ServiceEntity, Dict]:
        """
        Resuelve los conflictos entre iteraciones y retorna:
        - Entidad actualizada con datos ganadores
        - Reporte de decisiones tomadas
        """
        report = {
            "service_name": service.name,
            "total_iterations": len(service.perimeter_iterations),
            "decision": None,
            "winning_iteration": None,
            "conflicts_detected": [],
            "resolution_logic": ""
        }
        
        # CASO 1: Una sola iteración
        if len(service.perimeter_iterations) == 1:
            report["resolution_logic"] = "ÚNICA ITERACIÓN - Aceptar o descartar"
            iteration = service.perimeter_iterations[0]
            winning_data = iteration.data
            report["winning_iteration"] = iteration.iteration_id
            service.winning_data = winning_data
            return service, report
        
        # CASO 2: Múltiples iteraciones - Comparar y resolver
        if len(service.perimeter_iterations) > 1:
            report["resolution_logic"] = "MÚLTIPLES ITERACIONES - Aplicar reglas de cascada"
            winning_iteration = ConflictResolver._resolve_multiple_iterations(
                service.perimeter_iterations,
                report
            )
            
            if winning_iteration:
                service.winning_data = winning_iteration.data
                report["winning_iteration"] = winning_iteration.iteration_id
                report["decision"] = "RESUELTO"
            else:
                report["decision"] = "EN REVISIÓN"
        
        return service, report
    
    @staticmethod
    def _resolve_multiple_iterations(
        iterations: List[PerimeterIteration],
        report: Dict
    ) -> Optional[PerimeterIteration]:
        """
        Aplica reglas de cascada para múltiples iteraciones
        Retorna la iteración ganadora o None si hay conflictos sin resolver
        """
        # Agrupar por estado (simulado desde los datos)
        primary_data = iterations[0].data
        conflicts_by_field = ConflictResolver._detect_conflicts(iterations)
        
        report["conflicts_detected"] = [
            {
                "field": field,
                "values": list(set([str(v) for v in values]))
            }
            for field, values in conflicts_by_field.items()
        ]
        
        # REGLA 1: Si todas las iteraciones tienen los mismos datos, retornar la primera
        if len(conflicts_by_field) == 0:
            report["resolution_logic"] += " → Sin conflictos: datos idénticos"
            return iterations[0]
        
        # REGLA 2: Si hay conflictos, retornar None para revisión manual
        if len(conflicts_by_field) > 0:
            report["resolution_logic"] += f" → {len(conflicts_by_field)} campo(s) en conflicto"
            return None
        
        return None
    
    @staticmethod
    def _detect_conflicts(iterations: List[PerimeterIteration]) -> Dict[str, set]:
        """
        Detecta qué campos tienen valores diferentes entre iteraciones
        """
        if len(iterations) <= 1:
            return {}
        
        conflicts = {}
        first_data = iterations[0].data
        
        # Comparar todos los campos del modelo ExcelRowData
        fields_to_check = [
            'app', 'type', 'verb', 'scope', 'functional_use',
            'inputs', 'outputs', 'invokes', 'reference_tables',
            'source_document', 'doc_version', 'reliability'
        ]
        
        for field in fields_to_check:
            values = set()
            for iteration in iterations:
                field_value = getattr(iteration.data, field)
                # Convertir listas a tuplas para poder usar en set
                if isinstance(field_value, list):
                    values.add(tuple(sorted(field_value)))
                else:
                    values.add(str(field_value))
            
            if len(values) > 1:
                conflicts[field] = values
        
        return conflicts
    
    @staticmethod
    def resolve_field_choice(
        service: ServiceEntity,
        field_name: str,
        chosen_value: str,
        from_iteration_id: int
    ) -> ServiceEntity:
        """
        El usuario elige un valor específico de un campo de una iteración específica
        """
        if not service.winning_data:
            # Si no hay datos ganadores yet, copiar de la primera iteración
            service.winning_data = ExcelRowData(**service.perimeter_iterations[0].data.model_dump())
        
        # Actualizar el campo seleccionado
        if field_name in service.winning_data.model_fields:
            setattr(service.winning_data, field_name, chosen_value)
        
        return service
    
    @staticmethod
    def get_conflict_details(service: ServiceEntity) -> Dict:
        """
        Retorna un detalle completo de los conflictos para mostrar en UI
        """
        if len(service.perimeter_iterations) <= 1:
            return {
                "has_conflicts": False,
                "iterations_count": len(service.perimeter_iterations),
                "message": "Solo hay una iteración"
            }
        
        conflicts_by_field = ConflictResolver._detect_conflicts(service.perimeter_iterations)
        
        if len(conflicts_by_field) == 0:
            return {
                "has_conflicts": False,
                "iterations_count": len(service.perimeter_iterations),
                "message": "Todas las iteraciones tienen datos idénticos"
            }
        
        # Construir detalle de conflictos
        conflict_details = []
        for field, values in conflicts_by_field.items():
            field_conflict = {
                "field": field,
                "options": []
            }
            
            for iteration in service.perimeter_iterations:
                iteration_value = getattr(iteration.data, field)
                field_conflict["options"].append({
                    "iteration_id": iteration.iteration_id,
                    "value": str(iteration_value),
                    "doc_version": iteration.data.doc_version
                })
            
            conflict_details.append(field_conflict)
        
        return {
            "has_conflicts": True,
            "iterations_count": len(service.perimeter_iterations),
            "conflicts": conflict_details,
            "message": f"{len(conflicts_by_field)} campo(s) en conflicto entre iteraciones"
        }
