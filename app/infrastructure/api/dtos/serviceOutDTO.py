from pydantic import BaseModel
from typing import List
from app.domain.service import ServiceEntity


class ConflictResponseDTO(BaseModel):
    """DTO para representar conflictos en la respuesta API"""
    field: str
    original: str
    proposed: str


class IterationResponseDTO(BaseModel):
    """DTO para representar iteraciones en la respuesta API"""
    version: str
    use: str
    conflicts: List[ConflictResponseDTO]


class ServiceResponseDTO(BaseModel):
    """DTO de salida API - Convierte ServiceEntity a formato JSON para cliente"""
    service_name: str
    status: str
    is_in_dictionary: bool
    requires_attention: bool  # Calculado a partir de la lógica de negocio
    iterations: List[IterationResponseDTO]

    @classmethod
    def from_domain(cls, entity: ServiceEntity):
        """Mapeador: Convierte la Entidad de Dominio al formato de salida web"""
        iterations_dto = []
        for it in entity.iterations:
            conflicts_dto = [
                ConflictResponseDTO(
                    field=c.column,
                    original=c.dictionary_base_value,
                    proposed=c.perimeter_new_proposal
                ) for c in it.conflicts
            ]
            iterations_dto.append(IterationResponseDTO(
                version=it.doc_version,
                use=it.functional_use,
                conflicts=conflicts_dto
            ))

        return cls(
            service_name=entity.name,
            status=entity.consolidated_status,
            is_in_dictionary=True if entity.exists_in_dictionary.lower() == "si" else False,
            requires_attention=entity.has_critical_conflicts(),
            iterations=iterations_dto
        )