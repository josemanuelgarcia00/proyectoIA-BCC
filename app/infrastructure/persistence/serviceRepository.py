from app.database import services_collection
from app.infrastructure.persistence.dtos.servicePersistenceDTO import ServicePersistenceDTO


class MongoRepository:
    """Repositorio para acceso a datos en MongoDB"""
    
    def __init__(self):
        self.collection = services_collection

    def save_reconciled_services(self, reconciled_docs):
        """Guarda los servicios reconciliados en la base de datos"""
        # Borra todos los documentos existentes
        self.collection.delete_many({})
        
        # Convierte objetos Pydantic a diccionario
        data_to_insert = [doc.model_dump(by_alias=True) for doc in reconciled_docs]
        
        if data_to_insert:
            self.collection.insert_many(data_to_insert)
            print(f"✅ Se han insertado {len(data_to_insert)} registros en MongoDB.")
    
    def get_all(self):
        """Devuelve todos los documentos convertidos a Entidades de Dominio"""
        docs = list(self.collection.find({}))
        # Convierte datos de DB → DTO de persistencia → Entidad de Dominio
        return [ServicePersistenceDTO(**doc).to_domain() for doc in docs]

    def get_by_id(self, item_id: str):
        """Busca un documento específico por su _id y devuelve Entidad de Dominio"""
        doc = self.collection.find_one({"_id": item_id})
        if doc:
            return ServicePersistenceDTO(**doc).to_domain()
        return None