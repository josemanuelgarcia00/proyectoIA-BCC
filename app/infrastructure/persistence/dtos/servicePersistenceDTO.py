from pydantic import BaseModel, Field
from typing import List, Any, Optional
from app.domain.service import ServiceEntity, PerimeterIteration, CellConflict, ExcelRowData

class ServicePersistenceDTO(BaseModel):
    """DTO de entrada desde MongoDB - Mapea la estructura de base de datos a Dominio"""
    id: str = Field(alias="_id") 
    exists_in_dictionary: str
    consolidated_status: str
    winning_data: Optional[dict] = None  
    perimeter_iterations: List[Any] = [] 

    def _map_excel_row(self, raw_data: dict) -> Optional[ExcelRowData]:
        """Convierte un dict de Mongo a tu objeto ExcelRowData completo"""
        if not raw_data:
            return None
        return ExcelRowData(
            app=raw_data.get("app", ""),
            type=raw_data.get("type", ""),
            verb=raw_data.get("verb", ""),
            scope=raw_data.get("scope", ""),
            functional_use=raw_data.get("functional_use", ""),
            inputs=raw_data.get("inputs", []),
            outputs=raw_data.get("outputs", []),
            invokes=raw_data.get("invokes", []),
            reference_tables=raw_data.get("reference_tables", []),
            source_document=raw_data.get("source_document", ""),
            doc_version=str(raw_data.get("doc_version", "")),
            reliability=raw_data.get("reliability", "")
        )

    def to_domain(self) -> ServiceEntity:
        domain_iterations = []
        for it in self.perimeter_iterations:
            conflicts = [
                CellConflict(
                    column=c.get("column", ""),
                    dictionary_base_value=c.get("dictionary_base_value", ""),
                    perimeter_new_proposal=c.get("perimeter_new_proposal", "")
                ) for c in it.get("conflicts", [])
            ]
            domain_iterations.append(PerimeterIteration(
                iteration_id=it.get("iteration_id", 0),
                data=self._map_excel_row(it.get("data", {})), 
                conflicts=conflicts
            ))

        return ServiceEntity(
            name=self.id,
            exists_in_dictionary=self.exists_in_dictionary,
            consolidated_status=self.consolidated_status,
            winning_data=self._map_excel_row(self.winning_data),
            perimeter_iterations=domain_iterations
        )