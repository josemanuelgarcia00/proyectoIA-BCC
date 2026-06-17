from app.infrastructure.persistence.serviceRepository import MongoRepository

class ServiceService:
    def __init__(self):
        # El servicio asume la responsabilidad de conectar con la persistencia
        self.repo = MongoRepository()

    def get_full_catalog(self):
        """
        Orquesta la obtención de todo el catálogo.
        Aquí reside la lógica de negocio aplicable antes de devolver los datos.
        """
        return self.repo.get_all()
    
    def get_catalog_item(self, item_id: str):
        """
        Orquesta la obtención de un servicio específico.
        """
        return self.repo.get_by_id(item_id)
    
    def get_services_with_conflicts(self):
        """
        Obtiene servicios que tienen conflictos sin resolver.
        """
        return self.repo.get_services_with_conflicts()
    
    def get_resolved_services(self):
        """
        Obtiene servicios que fueron resueltos o no tienen conflictos.
        Estos irían al diccionario final.
        """
        return self.repo.get_resolved_services()