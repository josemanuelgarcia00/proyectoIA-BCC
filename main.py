"""
SERVIDOR FASTAPI PRINCIPAL
Gestor de conflictos entre iteraciones de servicios
Lee datos desde Excel local o Google Sheets, según DATA_SOURCE
"""
import uvicorn
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

# Importar routers
from app.infrastructure.api.routers.controllers.serviceController import router as service_router
from app.infrastructure.storage.dataSourceFactory import get_data_source, get_excel_path, get_source_label

# Crear aplicación
app = FastAPI(
    title="Gestor de Conflictos - ProyectoIA",
    description="Sistema de resolución de conflictos entre iteraciones de servicios (datos desde Excel)",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(service_router)


@app.get("/", tags=["Inicio"])
async def root():
    """Redirige a la interfaz web de resolución de conflictos"""
    return RedirectResponse(url="/api/v1/services/ui")


@app.get("/health", tags=["Salud"])
async def health():
    """Verificar que el servidor está operativo"""
    return {
        "status": "healthy",
        "service": "Gestor de Conflictos",
        "version": "1.0.0",
        "data_source": get_source_label()
    }


if __name__ == "__main__":
    # Verificar que la fuente de datos configurada es accesible antes de arrancar
    if get_data_source() == "excel":
        excel_path = get_excel_path()
        if not os.path.exists(excel_path):
            print("❌ ERROR: Archivo Excel no encontrado.")
            print(f"📍 Se espera en: {excel_path}")
            print("💡 Por favor, asegúrate de que CARGA_SERVICIOS.xlsx existe en la carpeta data/")
            exit(1)
    else:
        sheet_id = os.environ.get("GOOGLE_SHEET_ID")
        credentials_path = os.environ.get("GOOGLE_SHEETS_CREDENTIALS_PATH", "credentials.json")
        if not sheet_id:
            print("❌ ERROR: DATA_SOURCE=google_sheets pero falta la variable GOOGLE_SHEET_ID.")
            exit(1)
        if not os.path.exists(credentials_path):
            print(f"❌ ERROR: No se encontró el archivo de credenciales en: {credentials_path}")
            exit(1)
    
    print("=" * 70)
    print("🚀 INICIANDO SERVIDOR - GESTOR DE CONFLICTOS")
    print("=" * 70)
    print()
    print("📍 Acceso a la aplicación:")
    print("   🌐 Web UI: http://localhost:8000")
    print("   📊 API Docs: http://localhost:8000/docs")
    print("   ⚙️  ReDoc: http://localhost:8000/redoc")
    print()
    print("💡 Endpoints útiles:")
    print("   GET  /health - Verificar estado")
    print("   GET  /api/v1/services/conflicts - Ver servicios con conflictos")
    print("   GET  /api/v1/services/resolved - Ver diccionario resuelto")
    print("   GET  /api/v1/services/{id} - Obtener servicio por ID")
    print()
    print(f"📁 Datos leídos desde: {get_source_label()}")
    print("⏹️  Presiona Ctrl+C para detener el servidor")
    print("=" * 70)
    print()

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
