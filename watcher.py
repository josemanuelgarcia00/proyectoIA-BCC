import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess
import os

class ExcelChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        print(f"DEBUG: Evento detectado en {event.src_path}") # <-- Esto nos dirá si detecta ALGO
        
        # Filtramos correctamente
        if "CARGA_SERVICIOS.xlsx" in event.src_path and not "~$" in event.src_path:
            print("🔄 Cambio válido detectado. Ejecutando...")
            import subprocess
            subprocess.run(["python", "seed.py"])
        else:
            print("DEBUG: Evento ignorado (es archivo temporal o no coincide)")