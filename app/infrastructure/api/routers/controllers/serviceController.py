from fastapi import APIRouter, HTTPException
from typing import List
from app.application.serviceService import ServiceService
from app.infrastructure.api.dtos.serviceOutDTO import ServiceResponseDTO

router = APIRouter(
    prefix="/api/v1/services",
    tags=["Services"]
)


@router.get("/", response_model=List[ServiceResponseDTO], summary="Obtener el catálogo completo")
def get_services():
    """Obtiene todos los servicios del catálogo"""
    try:
        # El controlador SOLO conoce y llama a la capa de aplicación
        service = ServiceService()
        
        # 1. Recibimos las Entidades de Dominio
        domain_entities = service.get_full_catalog()
        
        # 2. Mapeamos cada entidad de dominio al DTO de presentación web
        catalog_response = [ServiceResponseDTO.from_domain(entity) for entity in domain_entities]
        
        return catalog_response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/{item_id}", response_model=ServiceResponseDTO, summary="Obtener un ítem del catálogo por ID")
def get_service_by_id(item_id: str):
    """Obtiene un servicio específico del catálogo por su identificador"""
    try:
        service = ServiceService()
        
        # 1. Recibimos la Entidad de Dominio
        domain_entity = service.get_catalog_item(item_id.upper())
        
        if not domain_entity:
            raise HTTPException(status_code=404, detail="Ítem del catálogo no encontrado")
            
        # 2. Mapeamos la entidad al DTO de presentación
        item_response = ServiceResponseDTO.from_domain(domain_entity)
        
        return item_response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))