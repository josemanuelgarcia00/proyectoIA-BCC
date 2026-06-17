from app.database import services_collection

class MongoRepository:
    def __init__(self):
        # Usamos la colección importada directamente del archivo database.py
        self.collection = services_collection

    def save_reconciled_services(self, reconciled_docs):
        # Borra todos los documentos de la colección existente 
        # (más seguro que 'drop' respecto a permisos de usuario)
        self.collection.delete_many({})
        
        # Convertimos objetos Pydantic a diccionario
        data_to_insert = [doc.model_dump(by_alias=True) for doc in reconciled_docs]
        
        if data_to_insert:
            self.collection.insert_many(data_to_insert)
            print(f"✅ Se han insertado {len(data_to_insert)} registros en MongoDB.")
    
    def get_all(self):
        """Devuelve todos los documentos de la colección."""
        return list(self.collection.find({}))

    def get_by_id(self, item_id: str):
        """Busca un documento específico por su _id."""
        return self.collection.find_one({"_id": item_id})