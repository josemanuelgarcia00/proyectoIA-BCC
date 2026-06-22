import json
import time

from app.infrastructure.storage.dataSourceFactory import build_reader, build_audit_log
from app.domain.service import ServiceEntity


class CatalogRepository:
    """Repositorio que lee servicios desde la fuente configurada (Excel local
    o Google Sheets, ver dataSourceFactory) y los cachea en memoria (singleton).

    Es singleton porque cada request HTTP instancia ServiceService() de nuevo;
    si no se compartiera la instancia, cualquier resolución de conflictos se
    perdería en la siguiente petición al recrearse el cache desde la fuente.
    """

    _instance = None

    # En Google Sheets, comprobar "¿cambió algo?" cuesta una llamada a la API
    # igual que una recarga completa (no hay un mtime barato como en Excel).
    # Para que navegar por la web no dispare una llamada a la API en cada
    # clic, espaciamos esa comprobación como mínimo este número de segundos;
    # mientras tanto se sirve la caché tal cual. Un cambio hecho fuera de la
    # app (editando el Sheet a mano) puede tardar hasta este margen en notarse.
    MIN_CHECK_INTERVAL_SECONDS = 15

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
        # Nombres de servicios ya guardados (ver remove_from_cache) que no deben
        # reaparecer en el catálogo activo mientras dure este proceso, aunque
        # sus filas en Perímetro sigan ahí y el catálogo se recargue de nuevo.
        self._excluded_from_catalog = set()
        self._load_services()
        self._last_checked_at = time.monotonic()
        self._initialized = True

    def _load_services(self, dictionary_records=None, perimeter_records=None):
        """Carga los servicios y el índice del Diccionario desde la fuente configurada,
        en una sola pasada por los datos (una sola lectura de la fuente: en Google
        Sheets cada lectura es una llamada a la API, así que evitamos repetirla
        para no agotar la cuota). Si quien llama ya leyó los registros (p.ej.
        refresh_if_source_changed calculando la firma), se le pueden pasar aquí
        para no volver a leer la fuente una segunda vez."""
        try:
            if dictionary_records is None or perimeter_records is None:
                dictionary_records, perimeter_records = self.reader.read_excel_sheets()
            self.dictionary_cache = self.reader._build_dictionary_index(dictionary_records)
            self.services_cache = self.reader.extract_services_from_records(
                dictionary_records, perimeter_records
            )
            if self._excluded_from_catalog:
                self.services_cache = [
                    s for s in self.services_cache if s.name.upper() not in self._excluded_from_catalog
                ]
            self._source_signature = self.reader.get_signature(dictionary_records, perimeter_records)
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
            return
        except Exception as e:
            print(f"❌ Error al leer la fuente de datos: {str(e)}")
            self.services_cache = []
            self.dictionary_cache = {}
            return

        # El replay va aparte y no puede tirar abajo lo que ya se cargó bien: si
        # falla (p.ej. límite de peticiones a la API), el catálogo se queda sin
        # las revisiones restauradas en vez de vaciarse por completo.
        try:
            self._replay_audit_log()
        except Exception as e:
            print(f"⚠️ No se pudo reproducir la auditoría (el catálogo sigue disponible sin ella): {e}")

    def _replay_audit_log(self):
        """
        Restaura sobre el catálogo recién cargado el último estado aceptado de
        cada servicio, leído de la hoja Auditoria. Esto reconstruye la revisión
        aunque el servidor se haya reiniciado entre medias: la fuente de verdad
        de lo decidido es esa hoja (su columna 'snapshot', una foto completa y
        ya resuelta del servicio en el momento de la decisión), no la caché en
        memoria ni recalcular la lógica de conflictos de nuevo.

        La auditoría vive en la misma fuente que el resto del catálogo (Excel
        local o Google Sheets, según DATA_SOURCE); si no existe o no tiene
        hoja Auditoria, simplemente no hay nada que restaurar.
        """
        entries = build_audit_log().read_all()

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

    def remove_from_cache(self, names) -> None:
        """
        Excluye del catálogo activo los servicios ya guardados (volcados a
        Diccionario/Desechados), para que dejen de aparecer en "Guardar en
        Excel" y demás vistas durante el resto de esta sesión. Sus filas en
        Perímetro siguen ahí tal cual, así que si el servidor se reinicia
        podrían volver a aparecer (este filtro vive solo en memoria, no se
        persiste en el Excel).
        """
        if not names:
            return

        name_set = {n.upper() for n in names}
        self._excluded_from_catalog |= name_set
        if self.services_cache:
            self.services_cache = [s for s in self.services_cache if s.name.upper() not in name_set]

    def refresh(self):
        """Recarga los servicios desde la fuente de datos (sin pasar por el
        margen mínimo entre comprobaciones: es una recarga pedida a propósito)"""
        self._load_services()
        self._last_checked_at = time.monotonic()

    def refresh_if_source_changed(self) -> bool:
        """
        Si los datos de origen cambiaron desde la última carga, recarga el
        catálogo completo desde cero. Si no han cambiado, no hace nada y
        conserva cualquier revisión de conflictos ya aplicada en memoria.
        Devuelve True si recargó, False si no había cambios.

        Para no golpear la API de Google Sheets en cada clic de la interfaz,
        la comprobación en sí (que ya cuesta una llamada) se espacia como
        mínimo MIN_CHECK_INTERVAL_SECONDS; dentro de ese margen se asume que
        no ha cambiado y se sirve la caché tal cual.
        """
        now = time.monotonic()
        if now - self._last_checked_at < self.MIN_CHECK_INTERVAL_SECONDS:
            return False
        self._last_checked_at = now

        try:
            dictionary_records, perimeter_records = self.reader.read_excel_sheets()
            new_signature = self.reader.get_signature(dictionary_records, perimeter_records)
        except Exception:
            # Si nunca hubo una carga exitosa (p.ej. la inicial falló por un
            # límite temporal de la API), no nos quedamos atascados para
            # siempre: probamos una carga completa de todas formas.
            if self._source_signature is None and not self.services_cache:
                self._load_services()
                return True
            return False

        if self._source_signature is None or new_signature != self._source_signature:
            print("🔄 Cambio detectado en la fuente de origen, recargando catálogo...")
            # Ya se leyeron los registros para calcular la firma: se reutilizan
            # aquí en vez de volver a leer la fuente por segunda vez.
            self._load_services(dictionary_records, perimeter_records)
            return True

        return False

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
