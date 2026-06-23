"""
MOTOR DE RESOLUCIÓN DE CONFLICTOS
Implementa la lógica de decisiones basada en iteraciones múltiples
"""
from typing import Optional
from app.domain.service import (
    ServiceEntity, PerimeterIteration, ExcelRowData, LIST_FIELDS, has_new_content
)


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
        if not has_new_content(current_value, previous_value, field_name):
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
        Rechaza la propuesta pendiente del Perímetro para este servicio. No se
        borra ningún dato, solo se cierra para que deje de aparecer entre los
        pendientes.

        El significado de "rechazar" depende de si el servicio ya existía en
        el Diccionario:
        - Si es nuevo (no existía), rechazarlo significa no incorporarlo: se
          marca "Desechado" para que se archive en la hoja Desechados.
        - Si ya existía en el Diccionario, rechazar la propuesta nueva NO debe
          desechar el dato maestro ya aceptado: se cierra como "Aceptado" (sin
          cambios), para no marcar como descartado algo que sigue vigente en
          el Diccionario.
        """
        service.closed = True
        if service.exists_in_dictionary == "Si":
            service.consolidated_status = "Aceptado"
        else:
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
