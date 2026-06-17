from pydantic import BaseModel
from typing import List, Optional

class ConflictEntity(BaseModel):
    column: str
    dictionary_base_value: str
    perimeter_new_proposal: str

class IterationEntity(BaseModel):
    iteration_id: int
    doc_version: str
    functional_use: str
    conflicts: List[ConflictEntity] = []

class ServiceEntity(BaseModel):
    name: str  # Nota que no usamos "_id" aquí, eso es de base de datos
    exists_in_dictionary: str
    consolidated_status: str
    iterations: List[IterationEntity] = []

    # Aquí irían métodos de negocio reales. Ejemplo:
    def has_critical_conflicts(self) -> bool:
        return any(len(it.conflicts) > 0 for it in self.iterations)