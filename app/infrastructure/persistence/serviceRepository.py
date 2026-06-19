import json

from app.infrastructure.storage.dataSourceFactory import build_reader, get_excel_path
from app.infrastructure.storage.auditLog import ExcelAuditLog
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
            self._replay_audit_log()
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

    def _replay_audit_log(self):
        """
        Restaura sobre el catálogo recién cargado el último estado aceptado de
        cada servicio, leído de la hoja Auditoria. Esto reconstruye la revisión
        aunque el servidor se haya reiniciado entre medias: la fuente de verdad
        de lo decidido es esa hoja (su columna 'snapshot', una foto completa y
        ya resuelta del servicio en el momento de la decisión), no la caché en
        memoria ni recalcular la lógica de conflictos de nuevo.

        Por ahora la auditoría solo existe sobre el Excel físico local (todavía
        no hay acceso a la API de Google Sheets para esto); si el archivo no
        existe o no tiene hoja Auditoria, simplemente no hay nada que restaurar.
        """
        entries = ExcelAuditLog(get_excel_path()).read_all()

        # Cada entrada es una foto completa del servicio en ese momento, así que
        # solo nos interesa la última por servicio (las anteriores ya quedaron
        # incluidas en ella).
        latest_snapshot_by_service = {}
        for entry in entries:
            raw_snapshot = entry.get("snapshot", "")
            if not raw_snapshot:
                continue
            servicio = str(entry.get("servicio", ""))
            try:
                latest_snapshot_by_service[servicio] = json.loads(raw_snapshot)
            except (TypeError, ValueError):
                continue

        for servicio, snapshot_dict in latest_snapshot_by_service.items():
            service = self._find_in_cache(servicio)
            if service is None:
                continue
            self._restore_from_snapshot(service, snapshot_dict)

    @staticmethod
    def _restore_from_snapshot(fresh_service: ServiceEntity, snapshot_dict: dict) -> None:
        """
        Aplica sobre fresh_service (recién extraído del Perímetro/Diccionario
        actuales) los campos ya decididos guardados en snapshot_dict. Las
        iteraciones que no estén en el snapshot (p.ej. una nueva iteración
        añadida al Perímetro después de la última decisión) se dejan tal cual
        se acaban de leer, sin tocar; y original_data/original_conflicts de cada
        iteración siempre se conservan los recién leídos (son la base para
        poder "volver atrás" contra el origen actual).
        """
        snapshot_service = ServiceEntity.model_validate(snapshot_dict)

        fresh_service.winning_data = snapshot_service.winning_data
        fresh_service.exists_in_dictionary = snapshot_service.exists_in_dictionary
        fresh_service.consolidated_status = snapshot_service.consolidated_status
        fresh_service.closed = snapshot_service.closed
        fresh_service.observations = snapshot_service.observations

        snapshot_iterations = {it.iteration_id: it for it in snapshot_service.perimeter_iterations}
        for iteration in fresh_service.perimeter_iterations:
            saved = snapshot_iterations.get(iteration.iteration_id)
            if saved is None:
                continue
            iteration.data = saved.data
            iteration.conflicts = saved.conflicts
            iteration.resolution = saved.resolution
            iteration.observations = saved.observations

    def _find_in_cache(self, name: str) -> ServiceEntity:
        """Busca un servicio por nombre directamente en la caché ya cargada,
        sin disparar refresh_if_source_changed (a diferencia de get_by_id),
        para poder usarse durante la propia carga sin recursión."""
        if not self.services_cache:
            return None

        name_upper = name.upper()
        for service in self.services_cache:
            if service.name.upper() == name_upper:
                return service

        return None

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
        return self._find_in_cache(item_id)

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
