from pydantic import BaseModel
from typing import List, Optional
from app.domain.service import ServiceEntity, PerimeterIteration, CellConflict, ExcelRowData


class CellConflictResponseDTO(BaseModel):
    """DTO para representar conflictos en la respuesta API"""
    column: str
    original: str
    proposed: str


class ExcelRowDataResponseDTO(BaseModel):
    """DTO para representar datos de Excel en la respuesta API"""
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


class PerimeterIterationResponseDTO(BaseModel):
    """DTO para representar una iteración del perimetro en la respuesta API"""
    iteration_id: int
    data: ExcelRowDataResponseDTO
    conflicts: List[CellConflictResponseDTO]


class ServiceResponseDTO(BaseModel):
    """DTO de salida API - Convierte ServiceEntity a formato JSON para cliente"""
    service_name: str
    status: str
    is_in_dictionary: bool
    requires_attention: bool  # Calculado a partir de la lógica de negocio
    dictionary_data: Optional[ExcelRowDataResponseDTO] = None  # Datos del maestro
    perimeter_iterations: List[PerimeterIterationResponseDTO]

    @classmethod
    def from_domain(cls, entity: ServiceEntity):
        """Mapeador: Convierte la Entidad de Dominio al formato de salida web"""
        iterations_dto = []
        for it in entity.perimeter_iterations:
            conflicts_dto = [
                CellConflictResponseDTO(
                    column=c.column,
                    original=c.dictionary_base_value,
                    proposed=c.perimeter_new_proposal
                ) for c in it.conflicts
            ]
            
            data_dto = ExcelRowDataResponseDTO(
                app=it.data.app,
                type=it.data.type,
                verb=it.data.verb,
                scope=it.data.scope,
                functional_use=it.data.functional_use,
                inputs=it.data.inputs,
                outputs=it.data.outputs,
                invokes=it.data.invokes,
                reference_tables=it.data.reference_tables,
                source_document=it.data.source_document,
                doc_version=it.data.doc_version,
                reliability=it.data.reliability
            )
            
            iterations_dto.append(PerimeterIterationResponseDTO(
                iteration_id=it.iteration_id,
                data=data_dto,
                conflicts=conflicts_dto
            ))

        # --- Mapeo de los datos del diccionario si existen ---
        dict_data_dto = None
        if entity.winning_data:
            dict_data_dto = ExcelRowDataResponseDTO(
                app=entity.winning_data.app,
                type=entity.winning_data.type,
                verb=entity.winning_data.verb,
                scope=entity.winning_data.scope,
                functional_use=entity.winning_data.functional_use,
                inputs=entity.winning_data.inputs,
                outputs=entity.winning_data.outputs,
                invokes=entity.winning_data.invokes,
                reference_tables=entity.winning_data.reference_tables,
                source_document=entity.winning_data.source_document,
                doc_version=entity.winning_data.doc_version,
                reliability=entity.winning_data.reliability
            )
        # -----------------------------------------------------------

        return cls(
            service_name=entity.name,
            status=entity.consolidated_status,
            is_in_dictionary=True if entity.exists_in_dictionary.lower() == "si" else False,
            requires_attention=entity.has_critical_conflicts(),
            dictionary_data=dict_data_dto,
            perimeter_iterations=iterations_dto
        )