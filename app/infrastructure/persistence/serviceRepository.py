from app.infrastructure.storage.excelReader import ExcelReader
from app.domain.service import ServiceEntity
import os


class MongoRepository:
    """Repositorio que lee servicios desde Excel y los cachea en memoria (singleton).

    Es singleton porque cada request HTTP instancia ServiceService() de nuevo;
    si no se compartiera la instancia, cualquier resolución de conflictos se
    perdería en la siguiente petición al recrearse el cache desde el Excel.
    """

    _instance = None

    def __new__(cls, excel_path: str = None):
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._initialized = False
            cls._instance = instance
        return cls._instance

    def __init__(self, excel_path: str = None):
        if self._initialized:
            return

        # Usar ruta por defecto: data/CARGA_SERVICIOS.xlsx
        if excel_path is None:
            excel_path = os.path.join(
                os.path.dirname(__file__),
                "../../..",
                "data",
                "CARGA_SERVICIOS.xlsx"
            )

        self.excel_path = excel_path
        self.services_cache = None
        self._load_services()
        self._initialized = True

    def _load_services(self):
        """Carga los servicios desde Excel la primera vez"""
        if not os.path.exists(self.excel_path):
            print(f"⚠️ Archivo Excel no encontrado en: {self.excel_path}")
            self.services_cache = []
        else:
            try:
                reader = ExcelReader(self.excel_path)
                self.services_cache = reader.extract_services_from_perimeter()
                print(f"✅ Se cargaron {len(self.services_cache)} servicios desde Excel")
                
                # Mostrar resumen de conflictos
                services_with_conflicts = [s for s in self.services_cache if s.perimeter_iterations and any(
                    it.conflicts for it in s.perimeter_iterations
                )]
                if services_with_conflicts:
                    print(f"⚠️  {len(services_with_conflicts)} servicios con conflictos detectados")
            except Exception as e:
                print(f"❌ Error al leer Excel: {str(e)}")
                self.services_cache = []

    def refresh(self):
        """Recarga los servicios desde Excel"""
        self._load_services()

    def save_reconciled_services(self, reconciled_docs):
        """Guarda los servicios reconciliados (en Excel)"""
        print(f"💾 Se guardarían {len(reconciled_docs)} servicios reconciliados")
    
    def get_all(self) -> list:
        """Devuelve todos los servicios cargados desde Excel"""
        return self.services_cache if self.services_cache else []

    def get_by_id(self, item_id: str) -> ServiceEntity:
        """Busca un servicio específico por su ID (nombre)"""
        if not self.services_cache:
            return None
        
        item_id_upper = item_id.upper()
        for service in self.services_cache:
            if service.name.upper() == item_id_upper:
                return service
        
        return None
    
    def get_services_with_conflicts(self) -> list:
        """Retorna solo servicios que tienen conflictos"""
        if not self.services_cache:
            return []
        
        return [
            s for s in self.services_cache 
            if s.perimeter_iterations and any(
                it.conflicts for it in s.perimeter_iterations
            )
        ]
    
    def get_resolved_services(self) -> list:
        """Retorna servicios que fueron resueltos/aceptados (sin conflictos)"""
        if not self.services_cache:
            return []
        
        return [
            s for s in self.services_cache 
            if not (s.perimeter_iterations and any(
                it.conflicts for it in s.perimeter_iterations
            ))
        ]