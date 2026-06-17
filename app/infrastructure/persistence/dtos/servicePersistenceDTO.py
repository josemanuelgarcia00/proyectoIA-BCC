from pydantic import BaseModel, Field
from typing import List, Any
from app.domain.service import ServiceEntity, IterationEntity, ConflictEntity


class ServicePersistenceDTO(BaseModel):
    """DTO de entrada desde MongoDB - Mapea la estructura de base de datos a Dominio"""
    id: str = Field(alias="_id")  # MongoDB requiere _id
    exists_in_dictionary: str
    consolidated_status: str
    winning_data: Any  # Datos raw de MongoDB
    perimeter_iterations: List[Any] = []

    def to_domain(self) -> ServiceEntity:
        """Mapeador: Convierte el modelo de base de datos a Entidad de Dominio"""
        domain_iterations = []
        for it in self.perimeter_iterations:
            conflicts = [
                ConflictEntity(
                    column=c.get("column", ""),
                    dictionary_base_value=c.get("dictionary_base_value", ""),
                    perimeter_new_proposal=c.get("perimeter_new_proposal", "")
                ) for c in it.get("conflicts", [])
            ]
            domain_iterations.append(IterationEntity(
                iteration_id=it.get("iteration_id", 0),
                doc_version=it.get("data", {}).get("doc_version", ""),
                functional_use=it.get("data", {}).get("functional_use", ""),
                conflicts=conflicts
            ))

        return ServiceEntity(
            name=self.id,
            exists_in_dictionary=self.exists_in_dictionary,
            consolidated_status=self.consolidated_status,
            iterations=domain_iterations
        )