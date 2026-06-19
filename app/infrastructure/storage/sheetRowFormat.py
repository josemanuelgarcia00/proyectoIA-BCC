from app.domain.service import ExcelRowData

DICTIONARY_COLUMNS = [
    "servicio", "app", "tipo", "verbo", "ambito", "uso_funcional",
    "entradas", "salidas", "invoca", "tablas_referenciales",
    "documento_origen | version", "fiabilidad"
]

REJECTED_COLUMNS = DICTIONARY_COLUMNS + ["observaciones"]


def format_document_version(source_document: str, doc_version: str) -> str:
    """Combina documento de origen y versión en el formato de columna única
    del Diccionario, p.ej. 'AF_Solicitud....docx | v2.0'."""
    if not source_document:
        return ""
    if not doc_version:
        return source_document
    version_label = doc_version if doc_version.lower().startswith("v") else f"v{doc_version}"
    return f"{source_document} | {version_label}"


def row_from_data(service_name: str, data: ExcelRowData) -> dict:
    return {
        "servicio": service_name,
        "app": data.app,
        "tipo": data.type,
        "verbo": data.verb,
        "ambito": data.scope,
        "uso_funcional": data.functional_use,
        "entradas": ";".join(data.inputs),
        "salidas": ";".join(data.outputs),
        "invoca": ";".join(data.invokes),
        "tablas_referenciales": ";".join(data.reference_tables),
        "documento_origen | version": format_document_version(data.source_document, data.doc_version),
        "fiabilidad": data.reliability
    }


def merge_observations(previous: str, new: str) -> str:
    """Acumula las observaciones de sucesivos rechazos del mismo servicio,
    sin repetir un texto ya registrado."""
    previous = (previous or "").strip()
    new = (new or "").strip()
    if not new or new == previous:
        return previous
    if not previous:
        return new
    if new in previous:
        return previous
    return f"{previous} / {new}"
