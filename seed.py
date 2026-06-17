import os
from app.application.syncService import SyncService 
from app.infrastructure.storage.excelReader import ExcelReader
from app.infrastructure.persistence.serviceRepository import MongoRepository
from app.application.comparatorService import ComparatorService

def run_seed():
    """
    Punto de entrada síncrono para la sincronización manual.
    """
    print("🚀 Iniciando proceso de sincronización...")
    
    # 1. Definimos las rutas
    file_path = os.path.abspath("data/CARGA_SERVICIOS.xlsx")
    
    # 2. Instanciamos los adaptadores
    reader = ExcelReader(file_path)
    repo = MongoRepository()
    comparator = ComparatorService()
    
    # 3. Inyectamos las dependencias en el servicio
    service = SyncService(
        reader=reader,
        comparator=comparator,
        repo=repo
    )
    
    try:
        # 4. Ejecutamos de forma síncrona
        service.execute()
        print("✅ Sincronización completada con éxito.")
    except Exception as e:
        print(f"❌ Error durante la sincronización: {e}")

if __name__ == "__main__":
    run_seed()