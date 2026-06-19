from app.application.syncService import SyncService
from app.infrastructure.storage.dataSourceFactory import build_reader, get_source_label
from app.infrastructure.persistence.serviceRepository import CatalogRepository
from app.application.comparatorService import ComparatorService

def run_seed():
    """
    Punto de entrada síncrono para la sincronización manual.
    """
    print("🚀 Iniciando proceso de sincronización...")
    print(f"📁 Fuente de datos: {get_source_label()}")

    # 1. Instanciamos los adaptadores (Excel o Google Sheets, según DATA_SOURCE)
    reader = build_reader()
    repo = CatalogRepository()
    comparator = ComparatorService()

    # 2. Inyectamos las dependencias en el servicio
    service = SyncService(
        reader=reader,
        comparator=comparator,
        repo=repo
    )

    try:
        # 3. Ejecutamos de forma síncrona
        service.execute()
        print("✅ Sincronización completada con éxito.")
    except Exception as e:
        print(f"❌ Error durante la sincronización: {e}")

if __name__ == "__main__":
    run_seed()
