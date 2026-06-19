from app.infrastructure.storage.dataSourceFactory import build_reader
from app.domain.service import ServiceEntity


class CatalogRepository:
    """Repositorio que lee servicios desde la fuente configurada (Excel local
    o Google Sheets, ver dataSourceFactory) y los cachea en memoria (singleton).

    Es singleton porque cada request HTTP instancia ServiceService() de nuevo;
    si no se compartiera la instancia, cualquier resolución de conflictos se
    perdería en la siguiente petición al recrearse el cache desde la fuente.
    """

    _instance = None

    def __new__(cls, reader=None):
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._initialized = False
            cls._instance = instance
        return cls._instance

    def __init__(self, reader=None):
        if self._initialized:
            return

        self.reader = reader if reader is not None else build_reader()
        self.services_cache = None
        self.dictionary_cache = None
        self._source_signature = None
        self._load_services()
        self._initialized = True

    def _load_services(self):
        """Carga los servicios y el índice del Diccionario desde la fuente configurada,
        en una sola pasada por los datos"""
        try:
            dictionary_records, _ = self.reader.read_excel_sheets()
            self.dictionary_cache = self.reader._build_dictionary_index(dictionary_records)
            self.services_cache = self.reader.extract_services_from_perimeter()
            self._source_signature = self.reader.get_signature()
            print(f"✅ Se cargaron {len(self.services_cache)} servicios")

            # Mostrar resumen de conflictos
            services_with_conflicts = [s for s in self.services_cache if s.perimeter_iterations and any(
                it.conflicts for it in s.perimeter_iterations
            )]
            if services_with_conflicts:
                print(f"⚠️  {len(services_with_conflicts)} servicios con conflictos detectados")
        except FileNotFoundError as e:
            print(f"⚠️ Fuente de datos no encontrada: {e}")
            self.services_cache = []
            self.dictionary_cache = {}
        except Exception as e:
            print(f"❌ Error al leer la fuente de datos: {str(e)}")
            self.services_cache = []
            self.dictionary_cache = {}

    def refresh(self):
        """Recarga los servicios desde la fuente de datos"""
        self._load_services()

    def refresh_if_source_changed(self) -> bool:
        """
        Si los datos de origen cambiaron desde la última carga, recarga el
        catálogo completo desde cero. Si no han cambiado, no hace nada y
        conserva cualquier revisión de conflictos ya aplicada en memoria.
        Devuelve True si recargó, False si no había cambios.
        """
        try:
            new_signature = self.reader.get_signature()
        except Exception:
            return False

        if self._source_signature is None or new_signature != self._source_signature:
            print("🔄 Cambio detectado en la fuente de origen, recargando catálogo...")
            self._load_services()
            return True

        return False

    def save_reconciled_services(self, reconciled_docs):
        """Guarda los servicios reconciliados (en la fuente de origen)"""
        print(f"💾 Se guardarían {len(reconciled_docs)} servicios reconciliados")

    def get_all(self) -> list:
        """
        Devuelve todos los servicios cargados desde la fuente de origen. Antes
        de devolverlos, comprueba si los datos de origen cambiaron para
        recargar automáticamente si es necesario (ver refresh_if_source_changed).
        """
        self.refresh_if_source_changed()
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

    def get_rejected_services(self) -> list:
        """Retorna servicios marcados como Desechado (rechazados) en esta sesión"""
        if not self.services_cache:
            return []

        return [s for s in self.services_cache if s.consolidated_status == "Desechado"]

    def get_dictionary_rows(self) -> dict:
        """
        Devuelve el índice {nombre_servicio: datos} de la hoja Diccionario completa
        (independientemente de si ese servicio aparece o no en la hoja Perímetro
        actual). Se sirve desde caché y solo se relee la fuente si cambió
        (igual que get_all), para no reabrirla en cada petición y evitar
        conflictos con quien tenga el Excel abierto manualmente.
        """
        self.refresh_if_source_changed()
        return self.dictionary_cache if self.dictionary_cache else {}
