from app.infrastructure.persistence.serviceRepository import CatalogRepository
from app.application.conflictResolverService import ConflictResolver
from app.infrastructure.storage.dataSourceFactory import build_writer, get_excel_path
from app.infrastructure.storage.auditLog import ExcelAuditLog
from app.domain.service import ServiceEntity

class ServiceService:
    def __init__(self):
        # El servicio asume la responsabilidad de conectar con la persistencia
        self.repo = CatalogRepository()
        # La auditoría, por ahora, solo existe sobre el Excel físico local
        # (todavía no hay acceso a la API de Google Sheets para esto).
        self.audit = ExcelAuditLog(get_excel_path())

    def _log_decision(self, service: ServiceEntity, accion: str, valor: str = "", iteracion="") -> None:
        """
        Registra la decisión junto con una foto completa (snapshot) del estado
        ya resuelto del servicio en ese momento. La restauración tras una
        caída/recarga usa ese snapshot directamente (ver CatalogRepository),
        no vuelve a calcular nada, así que lo aceptado queda guardado tal cual.
        """
        self.audit.append(service.name, accion, valor, iteracion, service.model_dump_json())

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

    def get_rejected_services(self):
        """
        Obtiene los servicios rechazados (desechados) en esta sesión, para poder
        inspeccionarlos y, si procede, devolverlos a la zona de revisión.
        """
        return self.repo.get_rejected_services()

    def get_full_dictionary(self):
        """
        Devuelve TODO el contenido de la hoja Diccionario del Excel de origen, no
        solo los servicios que además aparecen en la hoja Perímetro actual. Para
        cada servicio del Diccionario: si tiene actividad en el Perímetro se usa
        su entidad en memoria (para reflejar revisiones en curso); si no, se
        construye una entrada de solo lectura a partir de la fila del Diccionario.
        """
        dictionary_rows = self.repo.get_dictionary_rows()
        catalog_by_name = {s.name: s for s in self.repo.get_all()}

        entities = []
        for name, row_data in dictionary_rows.items():
            service = catalog_by_name.get(name)
            if service:
                entities.append(service)
                continue

            entities.append(ServiceEntity(
                name=name,
                exists_in_dictionary="Si",
                consolidated_status="Aceptado",
                winning_data=row_data,
                perimeter_iterations=[],
                closed=True
            ))

        return entities

    def refresh_from_source(self):
        """
        Fuerza una relectura del Excel de origen, descartando cualquier
        resolución de conflictos aplicada en memoria.
        """
        self.repo.refresh()
        return self.repo.get_all()

    def resolve_iteration_conflicts(self, item_id: str, iteration_id: int, resolution: str):
        """
        Aplica la resolución del usuario a todos los conflictos de una iteración concreta.
        Devuelve el servicio actualizado, o None si no se encontró el servicio/iteración.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        iteration = ConflictResolver.resolve_iteration(service, iteration_id, resolution)
        if iteration is None:
            return None

        self._log_decision(service, "resolve_iteration", resolution, iteration_id)
        return service

    def revert_iteration(self, item_id: str, iteration_id: int):
        """
        Deshace la resolución aplicada a una iteración concreta, restaurando su
        estado original. Devuelve el servicio actualizado, o None si no existe.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        iteration = ConflictResolver.revert_iteration(service, iteration_id)
        if iteration is None:
            return None

        self._log_decision(service, "revert_iteration", "", iteration_id)
        return service

    def reset_service_conflicts(self, item_id: str):
        """
        Reinicia todas las iteraciones de un servicio a su estado original
        (deshace toda la revisión hecha hasta ahora sobre ese servicio).
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        result = ConflictResolver.reset_service(service)
        self._log_decision(service, "reset_service")
        return result

    def preview_accept_merge(self, item_id: str):
        """
        Calcula (sin aplicar) cómo quedaría el dato final en el Diccionario si se
        aceptaran los cambios de este servicio. Devuelve None si no existe el
        servicio o todavía tiene conflictos pendientes.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        return ConflictResolver.preview_final_merge(service)

    def accept_and_close_service(self, item_id: str):
        """
        Acepta el resultado final de la revisión de un servicio: lo une con el dato
        maestro del Diccionario y lo marca como cerrado. Devuelve None si el
        servicio no existe o todavía tiene conflictos pendientes.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        result = ConflictResolver.accept_and_close(service)
        if result is None:
            return None

        self._log_decision(service, "accept_and_close")
        return result

    def reject_service(self, item_id: str):
        """
        Rechaza por completo un servicio (p.ej. uno nuevo que no se quiere
        incorporar al Diccionario). Devuelve None si no existe.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        result = ConflictResolver.reject_service(service)
        self._log_decision(service, "reject_service")
        return result

    def revert_rejection(self, item_id: str):
        """
        Deshace el rechazo de un servicio y lo devuelve a la zona de revisión.
        Devuelve None si no existe.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        result = ConflictResolver.revert_rejection(service)
        self._log_decision(service, "revert_rejection")
        return result

    def update_observations(self, item_id: str, observations: str):
        """
        Guarda observaciones libres del usuario sobre un servicio.
        Devuelve None si no existe.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        service.observations = observations
        self._log_decision(service, "update_observations", observations)
        return service

    def update_iteration_observations(self, item_id: str, iteration_id: int, observations: str):
        """
        Guarda observaciones libres del usuario asociadas a una iteración concreta.
        Devuelve None si no se encontró el servicio o la iteración.
        """
        service = self.repo.get_by_id(item_id)
        if not service:
            return None

        iteration = next(
            (it for it in service.perimeter_iterations if it.iteration_id == iteration_id),
            None
        )
        if not iteration:
            return None

        iteration.observations = observations
        self._log_decision(service, "update_iteration_observations", observations, iteration_id)
        return service

    def save_to_excel(self):
        """
        Si ya no quedan conflictos pendientes en ningún servicio, vuelca el resultado
        final de cada uno a la hoja Diccionario del Excel de origen.
        """
        all_services = self.repo.get_all()
        pending = [
            s for s in all_services
            if any(it.conflicts for it in s.perimeter_iterations)
        ]
        if pending:
            return {"saved": False, "pending_services": len(pending)}

        writer = build_writer()
        written = writer.save_dictionary(all_services)
        rejected_written = writer.save_rejected(all_services)

        return {"saved": True, "services_written": written, "rejected_written": rejected_written}