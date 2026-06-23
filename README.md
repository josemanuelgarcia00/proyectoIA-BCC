# 🔧 Gestor de Conflictos - ProyectoIA (100% estático, sin backend)

Sistema web de resolución de conflictos entre iteraciones de datos del perímetro. Permite seleccionar y aplicar cambios sobre la primera iteración en función de lo que venga en las siguientes.

Tras la migración **ya no hay backend** (FastAPI/Render): toda la lógica de negocio + la interfaz son un único sitio estático en `frontend/`, desplegable desde GitHub Pages, que **lee y escribe** un Google Sheet a través de un **Google Apps Script** propio (ver [`apps-script/Code.gs`](apps-script/Code.gs)). No hay credenciales ni secretos en el frontend; el Apps Script se ejecuta con la identidad de quien lo publica, así que el Sheet puede quedarse privado.

> ⚠️ **Sin login ni token (de momento).** El Apps Script está publicado con acceso "cualquier usuario", así que **cualquiera con la URL `/exec` puede leer y escribir** el Sheet. Es una decisión consciente y temporal: más adelante se añadirá OAuth de Google para limitar quién puede escribir.

## 🎯 Características

- **Motor de Resolución de Conflictos** en JavaScript (`frontend/src/domain/conflictResolver.js`)
- **Interfaz Web**: React + Vite, en `frontend/`
- **Lógica de Cascada**: reglas para resolver conflictos contra el Diccionario o la iteración anterior
- **Sin servidor propio**: la fuente de datos es un Google Sheet, leído/escrito vía un Google Apps Script publicado como aplicación web
- **Log de auditoría**: cada decisión se registra en la hoja `Auditoria` del Sheet y se reproduce al recargar para no perder revisiones en curso

## 🏗️ Arquitectura

```
Google Sheet (Diccionario, Perímetro, Desechados, Perímetro_Historico, Auditoria)
  ↕ (lectura/escritura, sin secretos: identidad del Apps Script)
apps-script/Code.gs          → Google Apps Script publicado como aplicación web
  ↕ (fetch GET/POST a la URL del Apps Script)
frontend/src/google/         → llamadas al Apps Script (sheetsApi.js)
frontend/src/storage/        → parseo/lectura/escritura de hojas + log de auditoría
frontend/src/domain/         → entidades y motor de resolución de conflictos
frontend/src/repository/     → caché en memoria del catálogo + replay del log de auditoría
frontend/src/services/       → orquestación de alto nivel sobre el repositorio
frontend/src/api/            → capa fina que devuelve los datos listos para la interfaz
frontend/src/contexts/       → CatalogContext (estado de catálogo/vista), vía useCatalog()
frontend/src/components/     → interfaz (IterationReview, DictionaryEntry, RejectedEntry, SaveSelector)
```

No hay CORS que configurar ni servidor que desplegar: todo vive en `frontend/` y se publica como sitio estático.

## 🚀 Puesta en marcha

### 1. Publicar el Google Apps Script

1. Ve a [script.google.com](https://script.google.com/) → **Nuevo proyecto**.
2. Borra el contenido de `Code.gs` y pega el de [`apps-script/Code.gs`](apps-script/Code.gs).
3. Pon `SHEET_ID` (arriba del archivo) con el ID de tu Sheet (de la URL `.../d/<ID>/edit`).
4. **Implementar → Nueva implementación** → tipo **"Aplicación web"**:
   - Ejecutar como: **Yo** (tu cuenta de Google, con acceso al Sheet)
   - Quién tiene acceso: **Cualquier usuario**
5. Autoriza los permisos (lectura y escritura de tus Sheets).
6. Copia la URL que termina en `/exec`.

> Cada cambio en `Code.gs` requiere **Gestionar implementaciones → Nueva versión** para que la URL publicada lo use.

### 2. Configurar variables de entorno

```bash
cd frontend
cp .env.example .env
# Edita .env: VITE_GOOGLE_SHEET_ID (ID del Sheet) y VITE_APPS_SCRIPT_URL (la URL /exec)
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173/proyectoIA-BCC/` (ajusta `base` en `vite.config.js` si el repo se llama distinto).

### 3. Desplegar en GitHub Pages

1. En **Settings → Pages**, selecciona **Source: GitHub Actions**.
2. En **Settings → Secrets and variables → Actions → Variables**, crea `VITE_GOOGLE_SHEET_ID` y `VITE_APPS_SCRIPT_URL` (mismos valores que en `.env`).
3. Asegúrate de que `base` en `frontend/vite.config.js` coincide con el nombre del repo (`/proyectoIA-BCC/`).
4. Cada push a `main`, `develop` o `feature/migration` dispara [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que compila `frontend/` y publica `frontend/dist` en GitHub Pages.

## 🔌 Hojas del Google Sheet

| Hoja | Uso |
|------|-----|
| `Diccionario` | Catálogo maestro de servicios aceptados |
| `Perímetro` | Propuestas/iteraciones a revisar (sufijo `(n)` para iteraciones sucesivas) |
| `Desechados` | Servicios rechazados |
| `Perímetro_Historico` | Filas de Perímetro ya procesadas (archivadas con fecha) |
| `Auditoria` | Historial de decisiones (snapshot completo por acción), usado para restaurar el estado al recargar |

## ⚙️ Lógica de Resolución

Ver `frontend/src/domain/conflictResolver.js`:

- **Una Iteración**: aceptar o rechazar, sin conflictos que resolver.
- **Iteraciones idénticas al Diccionario**: se aceptan automáticamente.
- **Iteraciones con conflictos**: el usuario elige "Unificar" (combina ambos valores) o "Rechazar cambios" (mantiene la línea base) por cada iteración, en cascada.

Al pulsar **"Guardar en Google Sheets"**, los servicios resueltos se vuelcan a `Diccionario` (o `Desechados`), sus filas de `Perímetro` se archivan en `Perímetro_Historico` y se limpia su rastro en `Auditoria`.

## 🐛 Solución de problemas

### "Falta VITE_APPS_SCRIPT_URL para leer/escribir el Sheet"
Configura `frontend/.env` (ver `.env.example`) o, en GitHub Actions, las "Variables" del repositorio, con la URL `.../exec` de la implementación del Apps Script.

### Cambié `Code.gs` pero no se nota
Cada cambio requiere una **nueva versión** de la implementación (Implementar → Gestionar implementaciones → editar → Nueva versión).

### El POST de guardado falla por CORS
El frontend envía las escrituras con `Content-Type: text/plain` a propósito para evitar el preflight CORS que Apps Script no responde. Si tocas `sheetsApi.js`, mantén ese detalle.

## 📄 Licencia

Proyecto interno - ProyectoIA © 2025
