from fastapi import APIRouter, HTTPException
from app.application.catalogService import CatalogService

router = APIRouter(
    prefix="/api/v1/catalog",
    tags=["Catalog"]
)

@router.get("/", summary="Obtener el catálogo completo")
def get_catalog():
    try:
        # El controlador SOLO conoce y llama a la capa de aplicación
        service = CatalogService()
        catalog = service.get_full_catalog()
        
        return catalog
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/{item_id}", summary="Obtener un ítem del catálogo por ID")
def get_catalog_item(item_id: str):
    try:
        service = CatalogService()
        item = service.get_catalog_item(item_id.upper())
        
        if not item:
            raise HTTPException(status_code=404, detail="Ítem del catálogo no encontrado")
        return item
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))