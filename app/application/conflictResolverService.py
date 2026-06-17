"""
MOTOR DE RESOLUCIÓN DE CONFLICTOS
Implementa la lógica de decisiones basada en iteraciones múltiples
"""
from typing import List, Optional, Dict, Tuple
from app.domain.service import ServiceEntity, PerimeterIteration, ExcelRowData, CellConflict


class ConflictResolver:
    """Resuelve conflictos entre iteraciones del perímetro"""
    
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
