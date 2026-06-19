# 🔧 Gestor de Conflictos - ProyectoIA

Sistema web de resolución de conflictos entre iteraciones de datos del perímetro. Permite seleccionar y aplicar cambios sobre la primera iteración en función de lo que venga en las siguientes.

## 🎯 Características

- **Motor de Resolución de Conflictos**: Compara automáticamente iteraciones múltiples
- **Interfaz Web Minimalista**: Diseño limpio con paleta de azules
- **Lógica de Cascada**: Reglas inteligentes para resolver conflictos
- **Selección Manual de Campos**: Elige el valor que desees para cada campo en conflicto
- **Estados Visuales**: Códigos de color para fácil identificación
- **API RESTful**: Endpoints para integración con otros sistemas

## 🚀 Inicio Rápido

### Requisitos

- Python 3.8+
- pip

### Instalación

1. **Clonar o descargar el proyecto**
```bash
cd ProyectoIA
```

2. **Instalar dependencias**
```bash
pip install -r requirements.txt
```

### Ejecución

```bash
python main.py
```

**Nota**: Si no existe `servicios.xlsx`, el sistema generará automáticamente un archivo de ejemplo con datos de prueba y conflictos detectados.

La aplicación estará disponible en: `http://localhost:8000`

## 📋 Estructura del Proyecto

```
ProyectoIA/
├── main.py                          # Servidor FastAPI principal
├── generate_excel.py                # Generador de archivo Excel de ejemplo
├── servicios.xlsx                   # Archivo Excel con datos (auto-generado)
├── requirements.txt                 # Dependencias del proyecto
├── app/
│   ├── __init__.py
│   ├── application/
│   │   ├── serviceService.py        # Lógica de servicios
│   │   └── conflictResolverService.py  # Motor de resolución de conflictos
│   ├── domain/
│   │   └── service.py               # Entidades de dominio
│   └── infrastructure/
│       ├── api/
│       │   ├── dtos/
│       │   │   └── serviceOutDTO.py      # DTOs de salida
│       │   ├── templates/
│       │   │   └── conflict_resolver.html # Interfaz web
│       │   └── routers/
│       │       └── controllers/
│       │           └── serviceController.py  # Endpoints API
│       ├── persistence/
│       │   ├── dtos/
│       │   │   └── servicePersistenceDTO.py  # DTOs de persistencia
│       │   └── serviceRepository.py      # Acceso a datos (Lee Excel)
│       └── storage/
│           └── excelReader.py      # Lector de Excel y extractor de conflictos
└── data/                           # Carpeta de datos
```

## 🔌 Endpoints API

### Interfaz Web
- **GET** `/api/v1/services/ui` - Abre la interfaz web de resolución

### Servicios
- **GET** `/api/v1/services/` - Obtener todos los servicios
- **GET** `/api/v1/services/{id}` - Obtener servicio por ID

### Salud
- **GET** `/health` - Verificar estado del servidor

## 🎨 Interfaz Web

### Paleta de Colores

| Color | Uso |
|-------|-----|
| Azul Primario (#0066cc) | Encabezados, botones principales |
| Azul Claro (#e3f2fd) | Fondos de secciones |
| Verde (#d4edda) | Estado Aceptado ✅ |
| Púrpura (#e2d5f8) | Estado Unificado ⚖️ |
| Naranja (#ffe5b4) | Estado En Revisión ⏳ |
| Rojo (#f8d7da) | Conflictos/Rechazado ❌ |

### Flujo de Uso

1. **Buscar Servicio**: Ingresa el ID del servicio
2. **Ver Iteraciones**: Se muestran todas las iteraciones disponibles
3. **Detectar Conflictos**: Sistema identifica campos con valores diferentes
4. **Seleccionar Valores**: Elige el valor deseado para cada campo
5. **Aplicar Resolución**: Confirma los cambios

## ⚙️ Lógica de Resolución

### Caso 1: Una Iteración
- Opción de **Aceptar** o **Rechazar**
- Sin necesidad de resolver conflictos

### Caso 2: Múltiples Iteraciones Idénticas
- Se acepta automáticamente
- Mensaje: "Todas las iteraciones tienen datos idénticos"

### Caso 3: Múltiples Iteraciones con Conflictos
- Se muestra interfaz de selección de campos
- Usuario elige el valor preferido para cada campo
- Se construye el registro final fusionando selecciones

## 🔐 Modelos de Datos

### ServiceEntity (Dominio)
```python
{
  "name": str,                       # ID del servicio
  "exists_in_dictionary": str,       # "Si" o "No"
  "consolidated_status": str,        # Estado actual
  "winning_data": ExcelRowData,      # Datos ganadores
  "perimeter_iterations": [          # Iteraciones
    {
      "iteration_id": int,
      "data": ExcelRowData,
      "conflicts": [CellConflict]
    }
  ]
}
```

### ExcelRowData
```python
{
  "app": str,
  "type": str,
  "verb": str,
  "scope": str,
  "functional_use": str,
  "inputs": [str],
  "outputs": [str],
  "invokes": [str],
  "reference_tables": [str],
  "source_document": str,
  "doc_version": str,
  "reliability": str
}
```

## 📊 Estados de Servicios

| Estado | Ícono | Significado |
|--------|-------|-----------|
| **Aceptado** | ✅ | Datos validados y listos |
| **Rechazado** | ❌ | Datos descartados |
| **Unificado** | ⚖️ | Datos unificados de múltiples fuentes |
| **En Revisión** | ⏳ | Esperando resolución manual |

## 🐛 Solución de Problemas

### Error: "Servicio no encontrado"
- Verifica que el ID del servicio sea correcto (usa el nombre de la columna "Nombre" en Perímetro)
- Asegúrate de que `servicios.xlsx` existe en la raíz del proyecto

### Error: "Archivo Excel no encontrado"
- El sistema generará automáticamente un archivo de ejemplo al iniciar
- O ejecuta: `python generate_excel.py` para crear uno manualmente

### El Excel no se lee correctamente
- Verifica que el Excel tenga las hojas: "Diccionario" y "Perímetro"
- Los nombres de columnas deben estar en la primera fila
- Asegúrate de que la estructura coincida con el archivo generado

### Puerto 8000 en uso
- Cambia el puerto en `main.py`:
```python
uvicorn.run("main:app", host="127.0.0.1", port=8001)
```

## 📝 Requisitos (requirements.txt)

```
fastapi
uvicorn
pydantic
pandas
openpyxl
gspread
google-auth
watchdog
```

**Nota**: No se usa MongoDB. Los datos se leen desde Excel local o Google Sheets, según la variable de entorno `DATA_SOURCE`.

## 🔄 Flujo de Datos

```
Excel (servicios.xlsx)
  ↓
ExcelReader (extrae y mapea datos)
  ↓
FastAPI Controller
  ↓
ServiceService (Aplicación)
  ↓
ConflictResolver (Motor de detección)
  ↓
ServiceResponseDTO (Serialización)
  ↓
Frontend Web (Visualización)
```

## 🎓 Ejemplo de Uso API

### Obtener Servicio
```bash
curl http://localhost:8000/api/v1/services/ACTIVOS
```

### Respuesta
```json
{
  "service_name": "ACTIVOS",
  "status": "En revision",
  "is_in_dictionary": true,
  "requires_attention": true,
  "perimeter_iterations": [
    {
      "iteration_id": 1,
      "data": {
        "app": "APP1",
        "type": "Recurso",
        "verb": "GET",
        ...
      },
      "conflicts": []
    }
  ]
}
```

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Proyecto interno - ProyectoIA © 2025

## 👥 Autor

Desarrollado como solución de resolución de conflictos para gestión de servicios.

---

**¿Preguntas?** Consulta la documentación de la API en `http://localhost:8000/docs`
