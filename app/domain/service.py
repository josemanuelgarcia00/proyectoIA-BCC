from pydantic import BaseModel, Field
from typing import List, Optional


# ==========================================
# ENTIDADES DE DOMINIO
# ==========================================
class CellConflict(BaseModel):
    """Representa un conflicto detectado en una celda"""
    column: str
    dictionary_base_value: str
    perimeter_new_proposal: str


class ExcelRowData(BaseModel):
    """Datos completos de una fila procesada del Excel"""
    app: str
    type: str
    verb: str
    scope: str
    functional_use: str
    inputs: List[str]
    outputs: List[str]
    invokes: List[str]
    reference_tables: List[str]
    source_document: str
    doc_version: str
    reliability: str


class PerimeterIteration(BaseModel):
    """Una iteración del perimetro con datos y conflictos identificados"""
    iteration_id: int
    data: ExcelRowData
    conflicts: List[CellConflict] = []


class ServiceEntity(BaseModel):
    """Entidad de dominio que representa un servicio con su historial de iteraciones"""
    name: str  # El ID del servicio (no usamos "_id" en dominio, eso es de BD)
    exists_in_dictionary: str
    consolidated_status: str
    winning_data: Optional[ExcelRowData] = None
    dictionary_data: Optional[dict] = None
    perimeter_iterations: List[PerimeterIteration] = []

    def has_critical_conflicts(self) -> bool:
        """Método de negocio: determina si hay conflictos críticos"""
        return any(len(it.conflicts) > 0 for it in self.perimeter_iterations)