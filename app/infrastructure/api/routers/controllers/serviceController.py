from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Literal, Optional
from app.application.serviceService import ServiceService
from app.application.conflictResolverService import ConflictResolver
from app.infrastructure.api.dtos.serviceOutDTO import ServiceResponseDTO, ExcelRowDataResponseDTO

router = APIRouter(
    prefix="/api/v1/services",
    tags=["Services"]
)


class ResolveIterationRequest(BaseModel):
    resolution: Literal["unify", "reject"] = "unify"


@router.get("/ui", response_class=HTMLResponse, summary="Abrir interfaz de resolución de conflictos")
def get_conflict_resolver_ui():
    """Abre la interfaz web para resolver conflictos"""
    with open("app/infrastructure/api/templates/conflict_resolver.html", "r", encoding="utf-8") as f:
        return f.read()


@router.post("/refresh", summary="Recargar el catálogo desde el Excel de origen")
def refresh_services():
    """Relee el Excel de origen, descartando cualquier resolución en memoria"""
    try:
        service = ServiceService()
        service.refresh_from_source()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveSelectionRequest(BaseModel):
    service_names: Optional[List[str]] = None


@router.post("/save-to-excel", summary="Volcar a Excel los servicios seleccionados (hoja Diccionario/Desechados)")
def save_to_excel(payload: SaveSelectionRequest = SaveSelectionRequest()):
    """
    Escribe en el Excel de origen el resultado final de los servicios indicados
    en service_names (si alguno de ellos todavía tiene conflictos pendientes, no
    se guarda nada y se informa cuántos quedan). Si no se indica service_names,
    se considera el catálogo completo (comportamiento anterior).
    """
    try:
        service = ServiceService()
        result = service.save_to_excel(payload.service_names)
        return result
    except PermissionError:
        raise HTTPException(
            status_code=409,
            detail="No se pudo guardar: el archivo Excel está abierto en otro programa (p. ej. Excel). Cierra el archivo y vuelve a intentarlo."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conflicts", response_model=List[ServiceResponseDTO], summary="Obtener servicios con conflictos")
def get_services_with_conflicts():
    """Obtiene solo los servicios que tienen conflictos detectados"""
    try:
        service = ServiceService()
        conflicted_entities = service.get_services_with_conflicts()
        
        if not conflicted_entities:
            return []
        
        response = [ServiceResponseDTO.from_domain(entity) for entity in conflicted_entities]
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/resolved", response_model=List[ServiceResponseDTO], summary="Obtener servicios resueltos")
def get_resolved_services():
    """Obtiene servicios que fueron resueltos/aceptados (sin conflictos)"""
    try:
        service = ServiceService()
        resolved_entities = service.get_resolved_services()
        
        if not resolved_entities:
            return []
        
        response = [ServiceResponseDTO.from_domain(entity) for entity in resolved_entities]
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/rejected", response_model=List[ServiceResponseDTO], summary="Obtener servicios rechazados (desechados)")
def get_rejected_services():
    """Obtiene los servicios marcados como Desechado en esta sesión"""
    try:
        service = ServiceService()
        rejected_entities = service.get_rejected_services()

        if not rejected_entities:
            return []

        response = [ServiceResponseDTO.from_domain(entity) for entity in rejected_entities]
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get(
    "/dictionary/full",
    response_model=List[ServiceResponseDTO],
    summary="Obtener TODO el contenido de la hoja Diccionario del Excel"
)
def get_full_dictionary():
    """
    Obtiene el contenido completo de la hoja Diccionario, incluyendo servicios
    que no tienen actividad en la hoja Perímetro actual (y que por tanto no
    aparecen en el catálogo general)
    """
    try:
        service = ServiceService()
        entities = service.get_full_dictionary()
        return [ServiceResponseDTO.from_domain(e) for e in entities]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/", response_model=List[ServiceResponseDTO], summary="Obtener el catálogo completo")
def get_services():
    """Obtiene todos los servicios del catálogo"""
    try:
        service = ServiceService()
        domain_entities = service.get_full_catalog()
        catalog_response = [ServiceResponseDTO.from_domain(entity) for entity in domain_entities]
        return catalog_response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/{item_id}", response_model=ServiceResponseDTO, summary="Obtener un ítem del catálogo por ID")
def get_service_by_id(item_id: str):
    """Obtiene un servicio específico del catálogo por su identificador"""
    try:
        service = ServiceService()
        domain_entity = service.get_catalog_item(item_id.upper())
        
        if not domain_entity:
            raise HTTPException(status_code=404, detail="Ítem del catálogo no encontrado")
            
        item_response = ServiceResponseDTO.from_domain(domain_entity)
        return item_response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{item_id}/iterations", summary="Obtener iteraciones de un servicio")
def get_service_iterations(item_id: str):
    """Obtiene las iteraciones de un servicio con conflictos"""
    try:
        service = ServiceService()
        domain_entity = service.get_catalog_item(item_id.upper())
        
        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
        
        if not domain_entity.perimeter_iterations:
            return []
        
        # Retornar iteraciones procesadas
        iterations = []
        for iteration in domain_entity.perimeter_iterations:
            conflicts_list = []
            if iteration.conflicts:
                for c in iteration.conflicts:
                    conflicts_list.append({
                        "column": c.column,
                        "dictionary_base_value": c.dictionary_base_value if hasattr(c, 'dictionary_base_value') else None,
                        "perimeter_new_proposal": c.perimeter_new_proposal if hasattr(c, 'perimeter_new_proposal') else None
                    })
            
            iteration_data = {
                "iteration_id": iteration.iteration_id,
                "conflicts": conflicts_list
            }
            iterations.append(iteration_data)
        
        print(f"DEBUG: Retornando {len(iterations)} iteraciones para {item_id}")
        return iterations
    except Exception as e:
        print(f"ERROR en /iterations: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{item_id}/iterations/{iteration_id}/resolve",
    response_model=ServiceResponseDTO,
    summary="Unificar todos los conflictos de una iteración"
)
def resolve_iteration(item_id: str, iteration_id: int, payload: ResolveIterationRequest):
    """Une la línea base (Diccionario o iteración anterior) con la nueva propuesta, sin eliminar nada"""
    try:
        service = ServiceService()
        domain_entity = service.resolve_iteration_conflicts(
            item_id.upper(), iteration_id, payload.resolution
        )

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio o iteración no encontrada")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{item_id}/iterations/{iteration_id}/revert",
    response_model=ServiceResponseDTO,
    summary="Volver atrás la resolución aplicada a una iteración"
)
def revert_iteration(item_id: str, iteration_id: int):
    """Restaura una iteración concreta a su estado original (antes de cualquier resolución)"""
    try:
        service = ServiceService()
        domain_entity = service.revert_iteration(item_id.upper(), iteration_id)

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio o iteración no encontrada")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{item_id}/reset",
    response_model=ServiceResponseDTO,
    summary="Reiniciar todos los conflictos de un servicio"
)
def reset_conflicts(item_id: str):
    """Restaura todas las iteraciones de un servicio a su estado original, deshaciendo la revisión"""
    try:
        service = ServiceService()
        domain_entity = service.reset_service_conflicts(item_id.upper())

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{item_id}/accept/preview",
    response_model=ExcelRowDataResponseDTO,
    summary="Previsualizar cómo quedaría el resultado final en el Diccionario"
)
def preview_accept(item_id: str):
    """Calcula (sin aplicar) el dato final que se guardaría en el Diccionario al aceptar"""
    try:
        service = ServiceService()
        merged = service.preview_accept_merge(item_id.upper())

        if merged is None:
            raise HTTPException(
                status_code=409,
                detail="El servicio no existe o todavía tiene conflictos pendientes"
            )

        return ExcelRowDataResponseDTO(
            app=merged.app,
            type=merged.type,
            verb=merged.verb,
            scope=merged.scope,
            functional_use=merged.functional_use,
            inputs=merged.inputs,
            outputs=merged.outputs,
            invokes=merged.invokes,
            reference_tables=merged.reference_tables,
            source_document=merged.source_document,
            doc_version=merged.doc_version,
            reliability=merged.reliability
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{item_id}/accept",
    response_model=ServiceResponseDTO,
    summary="Aceptar la revisión final y cerrar el servicio"
)
def accept_and_close(item_id: str):
    """Une el resultado final de la revisión con el dato maestro del Diccionario y cierra el servicio"""
    try:
        service = ServiceService()
        domain_entity = service.accept_and_close_service(item_id.upper())

        if not domain_entity:
            raise HTTPException(
                status_code=409,
                detail="El servicio no existe o todavía tiene conflictos pendientes"
            )

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{item_id}/reject",
    response_model=ServiceResponseDTO,
    summary="Rechazar el servicio (no incorporarlo al Diccionario)"
)
def reject_service(item_id: str):
    """Marca el servicio como descartado y lo cierra, sin borrar ningún dato"""
    try:
        service = ServiceService()
        domain_entity = service.reject_service(item_id.upper())

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{item_id}/reject/revert",
    response_model=ServiceResponseDTO,
    summary="Mover un servicio rechazado de vuelta a la zona de revisión"
)
def revert_reject_service(item_id: str):
    """Deshace el rechazo de un servicio y lo devuelve a los pendientes de revisión"""
    try:
        service = ServiceService()
        domain_entity = service.revert_rejection(item_id.upper())

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ObservationsRequest(BaseModel):
    observations: str


@router.put(
    "/{item_id}/observations",
    response_model=ServiceResponseDTO,
    summary="Guardar observaciones de un servicio"
)
def update_observations(item_id: str, payload: ObservationsRequest):
    """Guarda notas libres del usuario asociadas a un servicio"""
    try:
        service = ServiceService()
        domain_entity = service.update_observations(item_id.upper(), payload.observations)

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{item_id}/iterations/{iteration_id}/observations",
    response_model=ServiceResponseDTO,
    summary="Guardar observaciones de una iteración"
)
def update_iteration_observations(item_id: str, iteration_id: int, payload: ObservationsRequest):
    """Guarda notas libres del usuario asociadas a una iteración concreta"""
    try:
        service = ServiceService()
        domain_entity = service.update_iteration_observations(
            item_id.upper(), iteration_id, payload.observations
        )

        if not domain_entity:
            raise HTTPException(status_code=404, detail="Servicio o iteración no encontrada")

        return ServiceResponseDTO.from_domain(domain_entity)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))