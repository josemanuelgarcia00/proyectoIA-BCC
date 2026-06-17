from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from typing import List
from app.application.serviceService import ServiceService
from app.application.conflictResolverService import ConflictResolver
from app.infrastructure.api.dtos.serviceOutDTO import ServiceResponseDTO

router = APIRouter(
    prefix="/api/v1/services",
    tags=["Services"]
)


@router.get("/ui", response_class=HTMLResponse, summary="Abrir interfaz de resolución de conflictos")
def get_conflict_resolver_ui():
    """Abre la interfaz web para resolver conflictos"""
    with open("app/infrastructure/api/templates/conflict_resolver.html", "r", encoding="utf-8") as f:
        return f.read()


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