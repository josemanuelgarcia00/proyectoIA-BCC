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


# Campos del modelo que se representan como listas (la unificación hace un
# merge/unión en vez de comparar el texto completo)
LIST_FIELDS = {"inputs", "outputs", "invokes", "reference_tables"}


def has_new_content(current_value, baseline_value, field_name: str) -> bool:
    """
    Indica si current_value aporta algo que baseline_value todavía no
    contempla. Se usa tanto para detectar conflictos reales (solo si hay
    contenido nuevo que decidir) como para fusionar sin duplicar texto que
    ya forma parte de una unificación anterior (p.ej. si el valor base ya es
    "A / B" y llega de nuevo "B" suelto, no aporta nada nuevo).
    """
    if field_name in LIST_FIELDS:
        baseline_items = set(baseline_value or [])
        return any(item not in baseline_items for item in (current_value or []))

    current_value = (current_value or "").strip()
    baseline_value = (baseline_value or "").strip()
    if not current_value or current_value == baseline_value:
        return False
    if not baseline_value:
        return True

    # Un valor ya unificado queda concatenado con " / " (ver
    # ConflictResolver._merge_values); si la propuesta nueva ya es una de
    # esas partes, no aporta nada nuevo.
    baseline_parts = {p.strip() for p in baseline_value.split(" / ")}
    return current_value not in baseline_parts


class PerimeterIteration(BaseModel):
    """Una iteración del perimetro con datos y conflictos identificados"""
    iteration_id: int
    data: ExcelRowData
    conflicts: List[CellConflict] = []
    resolution: Optional[str] = None  # "perimeter" | "reject" | "unify", una vez revisada
    # Snapshot del estado original (antes de cualquier resolución), para poder volver atrás
    original_data: Optional[ExcelRowData] = None
    original_conflicts: List[CellConflict] = []
    observations: str = ""  # Notas libres del usuario, propias de esta iteración


class ServiceEntity(BaseModel):
    """Entidad de dominio que representa un servicio con su historial de iteraciones"""
    name: str  # El ID del servicio (no usamos "_id" en dominio, eso es de BD)
    exists_in_dictionary: str
    consolidated_status: str
    winning_data: Optional[ExcelRowData] = None
    dictionary_data: Optional[dict] = None
    perimeter_iterations: List[PerimeterIteration] = []
    closed: bool = False  # True cuando el usuario aceptó la revisión final y cerró el servicio
    observations: str = ""  # Notas libres del usuario sobre este servicio

    def has_critical_conflicts(self) -> bool:
        """Método de negocio: determina si hay conflictos críticos"""
        return any(len(it.conflicts) > 0 for it in self.perimeter_iterations)