import time
import subprocess
from app.infrastructure.storage.dataSourceFactory import get_data_source, build_reader


class ExcelChangeHandler:
    """Vigila data/CARGA_SERVICIOS.xlsx vía eventos del sistema de archivos."""

    def on_modified(self, event):
        print(f"DEBUG: Evento detectado en {event.src_path}")

        if "CARGA_SERVICIOS.xlsx" in event.src_path and "~$" not in event.src_path:
            print("🔄 Cambio válido detectado. Ejecutando...")
            subprocess.run(["python", "seed.py"])
        else:
            print("DEBUG: Evento ignorado (es archivo temporal o no coincide)")


def watch_excel_file():
    from watchdog.observers import Observer

    observer = Observer()
    observer.schedule(ExcelChangeHandler(), path="data", recursive=False)
    observer.start()
    print("👀 Vigilando cambios en data/CARGA_SERVICIOS.xlsx (eventos de archivo)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


def watch_google_sheets(poll_seconds: int = 30):
    """Google Sheets no emite eventos de archivo local, así que se sondea
    (polling) cada poll_seconds comparando la firma de contenido del lector."""
    reader = build_reader()
    last_signature = None
    print(f"👀 Vigilando cambios en Google Sheets (sondeo cada {poll_seconds}s)")

    while True:
        try:
            current_signature = reader.get_signature()
        except Exception as e:
            print(f"⚠️ Error al consultar Google Sheets: {e}")
            time.sleep(poll_seconds)
            continue

        if last_signature is not None and current_signature != last_signature:
            print("🔄 Cambio válido detectado en Google Sheets. Ejecutando...")
            subprocess.run(["python", "seed.py"])

        last_signature = current_signature
        time.sleep(poll_seconds)


if __name__ == "__main__":
    if get_data_source() == "google_sheets":
        watch_google_sheets()
    else:
        watch_excel_file()
