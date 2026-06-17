#!/usr/bin/env python3
"""
INICIO RÁPIDO DEL SERVIDOR
Ejecuta el servidor FastAPI con datos de ejemplo
"""

import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 INICIANDO SERVIDOR - GESTOR DE CONFLICTOS")
    print("=" * 60)
    print()
    print("📍 Acceso a la aplicación:")
    print("   🌐 Web UI: http://localhost:8000")
    print("   📊 API Docs: http://localhost:8000/docs")
    print("   ⚙️  ReDoc: http://localhost:8000/redoc")
    print()
    print("💡 Endpoints útiles:")
    print("   GET  /health - Verificar estado")
    print("   GET  /api/v1/services/ - Obtener todos los servicios")
    print("   GET  /api/v1/services/{id} - Obtener servicio por ID")
    print()
    print("⏹️  Presiona Ctrl+C para detener el servidor")
    print("=" * 60)
    print()

    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
