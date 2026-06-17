from pydantic import BaseModel, Field
from typing import List, Optional


# ==========================================
# MODELOS DE ESCRITURA (SYNC / COMPARATOR)
# ==========================================
class CellConflict(BaseModel):
    """Representa un conflicto en una celda entre diccionario base y perimetro"""
    column: str
    dictionary_base_value: str
    perimeter_new_proposal: str


class ExcelRowData(BaseModel):
    """Datos completos de una fila de Excel con información del servicio"""
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
    """Una iteración del perimetro con sus datos y conflictos"""
    iteration_id: int
    data: ExcelRowData
    conflicts: List[CellConflict]


class ServiceDocument(BaseModel):
    """DTO de persistencia - Mapea la estructura de MongoDB al dominio"""
    id: str = Field(alias="_id")  # Clave para guardar en Mongo
    exists_in_dictionary: str
    consolidated_status: str
    winning_data: Optional[ExcelRowData] = None
    perimeter_iterations: List[PerimeterIteration] = []