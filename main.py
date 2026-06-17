"""
SERVIDOR FASTAPI PRINCIPAL
Gestor de conflictos entre iteraciones de servicios
Lee datos desde data/CARGA_SERVICIOS.xlsx
"""
import uvicorn
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

# Importar routers
from app.infrastructure.api.routers.controllers.serviceController import router as service_router

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
        "data_source": "Excel - data/CARGA_SERVICIOS.xlsx"
    }


if __name__ == "__main__":
    # Verificar si existe el archivo Excel
    excel_path = os.path.join(os.path.dirname(__file__), "data", "CARGA_SERVICIOS.xlsx")
    
    if not os.path.exists(excel_path):
        print("❌ ERROR: Archivo Excel no encontrado.")
        print(f"📍 Se espera en: {excel_path}")
        print("💡 Por favor, asegúrate de que CARGA_SERVICIOS.xlsx existe en la carpeta data/")
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
    print(f"📁 Datos leídos desde: {excel_path}")
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
