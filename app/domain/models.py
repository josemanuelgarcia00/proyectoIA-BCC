from pydantic import BaseModel, Field
from typing import List, Optional

class ExcelRowData(BaseModel):
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

class CellConflict(BaseModel):
    column: str
    dictionary_base_value: str
    perimeter_new_proposal: str

class PerimeterIteration(BaseModel):
    iteration_id: int
    data: ExcelRowData
    conflicts: List[CellConflict]

class ServiceDocument(BaseModel):
    id: str = Field(..., alias="_id")
    exists_in_dictionary: str
    consolidated_status: str
    winning_data: Optional[ExcelRowData] = None
    perimeter_iterations: List[PerimeterIteration] = []