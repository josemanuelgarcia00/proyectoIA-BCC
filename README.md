# 🔧 Gestor de Conflictos de Servicios — Cajamar

Aplicación web para **conciliar el catálogo de servicios** cuando llegan nuevas
propuestas de datos. Cada vez que se revisa el perímetro de servicios pueden
llegar varias versiones (iteraciones) de un mismo servicio con datos distintos.
Esta herramienta ayuda a un revisor a decidir, servicio por servicio, **qué se
queda en el catálogo maestro y qué se descarta**, sin perder información por el
camino y dejando registro de cada decisión.

Es un sitio **100% estático** (React + Vite, sin backend propio). Lee y escribe
directamente sobre un **Google Sheet** a través de un pequeño **Google Apps
Script**. No hay servidores que mantener ni credenciales en el frontend.

## 🧩 Conceptos

Para entender la aplicación basta con estos cuatro conceptos:

- **Diccionario** — el catálogo maestro: la "verdad" actual de cada servicio
  aceptado.
- **Perímetro** — las propuestas a revisar. Un mismo servicio puede aparecer
  varias veces como iteraciones sucesivas (sufijo `(1)`, `(2)`…), cada una con
  posibles cambios respecto a la anterior.
- **Conflicto** — una columna cuyo valor en una iteración difiere de su *línea
  base* (la iteración anterior o, para la primera, el dato maestro del
  Diccionario). Es lo que el revisor tiene que resolver.
- **Resolución en cascada** — los conflictos se resuelven iteración a iteración
  en orden. Cada iteración se compara con la **inmediatamente anterior ya
  resuelta**, no con el original. Así los cambios se van acumulando de forma
  controlada.

Cada conflicto se resuelve de una de dos formas:

| Acción | Qué hace |
|--------|----------|
| **Unificar** | Combina el valor base y el nuevo (los une, sin duplicar). No se pierde nada. |
| **Rechazar cambios** | Descarta el valor nuevo de esa iteración y mantiene la línea base. |

---

## Flujo de trabajo

El revisor trabaja desde cuatro vistas (los botones de la cabecera):

### 1. Pendientes de revisión
Punto de partida. Lista los servicios que requieren atención: tienen conflictos
sin resolver, son servicios **nuevos** (aún no están en el Diccionario), o ya se
resolvieron pero todavía no se han confirmado.

Al seleccionar un servicio se ven todas sus iteraciones y, en cada una, los
conflictos. El revisor:

1. Resuelve cada iteración (**Unificar** o **Rechazar cambios**), en cascada.
2. Puede añadir **observaciones** al servicio o a una iteración concreta.
3. Cuando ya no quedan conflictos, decide el cierre del servicio:
   - **Aceptar y cerrar** → une el resultado final con el dato maestro y lo fija
     como definitivo para el Diccionario.
   - **Rechazar servicio** → si es nuevo queda **Desechado**; si ya existía en
     el Diccionario, se mantiene el dato maestro vigente.
4. Si se equivoca, puede **revertir** una iteración, **reiniciar** todo el
   servicio a su estado original, o deshacer un rechazo.

> Mientras un servicio no se "cierra" sigue visible en Pendientes aunque ya no
> tenga conflictos, para que ninguna revisión a medias se pierda de vista.

### 2. Diccionario completo
Consulta de **todo** el catálogo maestro, incluyendo servicios sin actividad en
el perímetro actual. Con búsqueda por nombre y orden alfabético. Es solo
lectura.

### 3. Desechados
Servicios marcados como rechazados en la sesión. Desde aquí se puede **devolver
un servicio a revisión** si se descartó por error.

### 4. Guardar en Google Sheets
Vista final. Permite elegir qué servicios volcar (o todos). Al guardar, los
servicios ya resueltos se escriben de forma definitiva:

- El resultado final se vuelca a **Diccionario** (aceptados) o **Desechados**
  (rechazados).
- Las filas correspondientes del **Perímetro** se archivan en
  **Perímetro_Historico** con fecha.
- Se limpia su rastro del registro de auditoría.

Solo se guardan servicios sin conflictos pendientes; si quedan, avisa y no
escribe.

---

## Estado y auditoría

Cada decisión (resolver, revertir, aceptar, rechazar, observaciones…) se anota
en la hoja **Auditoria** como un snapshot completo del servicio. Esto tiene un
efecto clave: **al recargar la página, la aplicación reproduce ese registro y
restaura el estado de la revisión en curso**. Se puede cerrar el navegador a
mitad de un trabajo sin perder lo avanzado, aunque todavía no se haya pulsado
"Guardar en Google Sheets".

El "guardar" definitivo es lo único que modifica el Diccionario maestro; hasta
entonces todo el trabajo vive en memoria + el log de auditoría.

---

## Hojas del Google Sheet

| Hoja | Uso |
|------|-----|
| `Diccionario` | Catálogo maestro de servicios aceptados |
| `Perímetro` | Propuestas/iteraciones a revisar (sufijo `(n)` para iteraciones sucesivas) |
| `Desechados` | Servicios rechazados |
| `Perímetro_Historico` | Filas de Perímetro ya procesadas, archivadas con fecha |
| `Auditoria` | Historial de decisiones; permite restaurar la revisión al recargar |

---

## Puesta en marcha (Local)

### 1. Publicar el Google Apps Script
1. En [script.google.com](https://script.google.com/) → **Nuevo proyecto**.
2. Pega el contenido de [`apps-script/Code.gs`](apps-script/Code.gs).
3. Pon `SHEET_ID` (arriba del archivo) con el ID de tu Sheet (de la URL
   `.../d/<ID>/edit`).
4. **Implementar → Nueva implementación** → tipo **"Aplicación web"**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario, incluso anónimos** (crítico para CORS)
5. Autoriza los permisos y copia la URL que termina en `/exec`.

> Cada cambio en `Code.gs` requiere **Gestionar implementaciones → Nueva
> versión** (o una implementación nueva) para que la URL publicada lo use.

### 2. Arrancar el frontend
```bash
cd frontend
cp .env.example .env
# Edita .env: VITE_GOOGLE_SHEET_ID (ID del Sheet) y VITE_APPS_SCRIPT_URL (la URL /exec)
npm install
npm run dev
```
Disponible en `http://localhost:5173/proyectoIA-BCC/` (ajusta `base` en
`vite.config.js` si el repo se llama distinto).
