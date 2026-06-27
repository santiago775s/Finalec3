# Simulador de Descargas Concurrentes — Backend + Frontend Vue 3

Sistema de simulación de descargas concurrentes construido con **Node.js + TypeScript**
(arquitectura DDD, Worker Threads) en el backend, y un **dashboard Vue 3 + TypeScript +
PrimeVue** en el frontend para crear, monitorear y reintentar descargas en tiempo real.

Este repositorio corresponde a las prácticas:

- **EC2**: Backend — simulador de descargas concurrentes con DDD y Worker Threads.
- **EC3**: Frontend Vue 3 + Testing (unitarios, integración y E2E con Jest + Supertest).

---

## Índice

1. [Requisitos previos](#requisitos-previos)
2. [Instalación](#instalación)
3. [Ejecución (backend + frontend)](#ejecución-backend--frontend)
4. [Endpoints de la API](#endpoints-de-la-api)
5. [Arquitectura del proyecto](#arquitectura-del-proyecto)
6. [Arquitectura del Frontend Vue 3](#arquitectura-del-frontend-vue-3)
7. [Guía de Tests](#guía-de-tests)
8. [Decisiones de alcance frente al enunciado](#decisiones-de-alcance-frente-al-enunciado)
9. [Problemas conocidos y soluciones aplicadas](#problemas-conocidos-y-soluciones-aplicadas)

---

## Requisitos previos

- Node.js 18+ (probado con Node 22)
- npm 9+

## Instalación

```bash
npm install
```

Esto instala tanto las dependencias del backend (Express, Worker Threads, etc.) como
las del frontend (Vue 3, Pinia, PrimeVue, Axios, Chart.js) y de testing (Jest, Supertest,
ts-jest), ya que ambos viven en el mismo `package.json`.

## Ejecución (backend + frontend)

Se necesitan **dos terminales** abiertas en paralelo: una para el backend y otra para
el frontend.

### Terminal 1 — Backend (puerto 3000)

```bash
npm run dev
```

Esto levanta la API REST en `http://localhost:3000` junto con la documentación Swagger
en `http://localhost:3000/api-docs`.

### Terminal 2 — Frontend (puerto 5173)

```bash
npm run frontend:dev
```

Esto levanta el dashboard Vue 3 en `http://localhost:5173`. El frontend está
configurado con un **proxy de Vite** (`vite.config.ts`) que reenvía automáticamente
cualquier petición a `/api/...` hacia `http://localhost:3000`, por lo que no hay
problemas de CORS en desarrollo y no es necesario configurar nada adicional: basta con
que el backend (Terminal 1) esté corriendo.

Abrir **http://localhost:5173** en el navegador para usar el dashboard.

### Build de producción del frontend

```bash
npm run frontend:build
```

Genera los archivos estáticos en `dist/` (verificado: compila sin errores de
TypeScript y sin errores de build).

---

## Endpoints de la API

El backend expone exactamente estos 4 endpoints bajo `/api/descargas` (ver
`src/interfaces/routes/descargas.routes.ts`):

### Crear descarga

```http
POST /api/descargas
Content-Type: application/json

{
  "url": "https://example.com/archivo.pdf",
  "tipo": "http",
  "maxReintentos": 3
}
```

`tipo` acepta `"http"`, `"ftp"` o `"mock"`. `maxReintentos` es opcional (por defecto 3
según `descargas.controller.ts`).

### Listar descargas

```http
GET /api/descargas
```

Devuelve `{ descargas: [...], total, completadas, pendientes, fallidas }`.

### Consultar estado

```http
GET /api/descargas/{id}/estado
```

### Reintentar descarga fallida

```http
POST /api/descargas/{id}/reintentar
```

Solo funciona si la descarga está en estado `FALLIDA`; de lo contrario responde
`400` con un mensaje descriptivo.

> **Nota:** el backend **no** expone un endpoint de detalle individual
> (`GET /api/descargas/{id}`) ni de cancelación (`POST /api/descargas/{id}/cancelar`).
> Ver la sección [Decisiones de alcance](#decisiones-de-alcance-frente-al-enunciado)
> para cómo se resolvió esto en la UI.

---

## Arquitectura del proyecto

```
src/
├── domain/            # Entidades, value objects, interfaces, errores (EC2)
├── application/       # Casos de uso y excepciones de aplicación (EC2)
├── infrastructure/    # Descargadores concretos, Worker Threads, repositorios (EC2)
├── interfaces/        # Controllers, rutas, middlewares Express (EC2)
├── shared/            # Config, enums, tipos, logger, utilidades (EC2)
├── server.ts          # Punto de entrada del backend
└── frontend/          # Dashboard Vue 3 + TypeScript (EC3)
    ├── components/    # Componentes .vue reutilizables
    ├── pages/         # DashboardPage.vue
    ├── services/      # apiClient.ts, downloadService.ts (Axios)
    ├── composables/   # useDownloads.ts, useDownloadForm.ts
    ├── stores/        # downloadStore.ts (Pinia)
    ├── types/         # Tipos TypeScript compartidos
    ├── utils/         # validators.ts, formatters.ts
    ├── __tests__/     # unit/, integration/, e2e/ (Jest + Supertest)
    ├── App.vue
    └── main.ts
```

## Arquitectura del Frontend Vue 3

### Flujo de datos

```
DashboardPage.vue
   ├── DownloadForm.vue  ──(useDownloadForm)──► downloadStore ──► downloadService ──► API
   ├── DownloadList.vue  ──(useDownloads)─────► downloadStore ──► downloadService ──► API
   │      └── DownloadCard.vue (modal de detalle, reutiliza datos ya cargados)
   ├── StatusDistributionChart.vue   (gráfico de dona)
   └── HourlyCompletionChart.vue     (gráfico de línea)
```

- **`downloadStore.ts` (Pinia)**: única fuente de verdad del estado de las descargas.
  Mantiene un `Map<id, Descarga>` para actualizaciones eficientes durante el polling y
  expone getters (`descargas`, `totales`) y acciones (`cargarDescargas`,
  `crearDescarga`, `reintentarDescarga`, `iniciarPolling`, `detenerPolling`).
- **`useDownloads.ts`**: composable que arranca el polling (cada 2 segundos, como pide
  el enunciado) cuando el componente se monta y lo detiene cuando se desmonta, evitando
  timers huérfanos.
- **`useDownloadForm.ts`**: composable que centraliza el estado reactivo del formulario,
  la validación campo por campo en tiempo real y el envío contra el store.
- **`downloadService.ts`**: capa de acceso a la API; traduce cualquier error de Axios a
  un `DownloadApiError` con un mensaje entendible para el usuario.

### Componentes específicos requeridos por el enunciado

| Componente | Implementado | Notas |
|---|---|---|
| `DownloadForm.vue` | Sí | Validación en tiempo real, prop `onSubmit` |
| `DownloadList.vue` | Sí | Tabla PrimeVue con búsqueda, colores por estado, paginación |
| `DownloadStatus.vue` | Sí | Badge de estado (Tag de PrimeVue) |
| `DownloadCard.vue` | Sí | Modal de detalle individual |
| `ProgressBar.vue` | Sí | Barra de progreso animada |
| `ErrorBoundary.vue` | Sí | Captura errores con `onErrorCaptured` |

### Stack técnico y justificación

- **Vue 3 + `<script setup>` + TypeScript**: sintaxis más concisa y tipado estricto en
  toda la capa de presentación.
- **Vite**: build tool exigido por el enunciado; arranque instantáneo en desarrollo.
- **PrimeVue**: se eligió sobre TailwindCSS/Vuetify porque provee `DataTable`, `Dialog`,
  `Dropdown`, `InputNumber` y `Chart` ya armados y accesibles, lo que permitió invertir
  el tiempo limitado de la práctica en la lógica de negocio (polling, validaciones,
  manejo de errores) en lugar de en componentes de UI desde cero.
- **Pinia**: estado global recomendado oficialmente para Vue 3; necesario aquí porque
  tanto el formulario como la tabla y los gráficos leen la misma lista de descargas.
- **Axios**: manejo de errores HTTP más ergonómico que `fetch` nativo
  (`error.response.status`, interceptors, etc.).
- **Chart.js** (vía `primevue/chart`): gráficos de dona y línea pedidos como
  "opcional pero recomendado" en la sección 1.1 del enunciado.

---

## Guía de Tests

Los tests están organizados en 3 proyectos de Jest independientes
(`jest.config.js`), tal como pide el enunciado en su sección de Stack Obligatorio
("Unitarios", "Integración", "E2E: jest supertest"):

```bash
npm test                 # corre las 3 suites (unit + integration + e2e)
npm run test:unit        # solo unitarios
npm run test:integration # solo integración
npm run test:e2e         # solo E2E
npm run test:watch       # modo watch
```

### Unitarios (`src/frontend/__tests__/unit/`) — 55 tests

Prueban elementos del **backend** de forma aislada, sin levantar el servidor HTTP:

- `descarga.test.ts` — entidad de dominio `Descarga` (transiciones de estado, reportes).
- `urlDescarga.test.ts` — value object `UrlDescarga`.
- `descargadorFactory.test.ts` — `DescargadorFactory` (creación por tipo).
- `descargadorMock.test.ts` — `DescargadorMock` y comportamiento heredado de
  `DescargadorBase` (reintentos, cancelación).
- `exceptions.test.ts` — las 4 excepciones de la capa de aplicación.
- `validators.test.ts` / `formatters.test.ts` — utilidades puras del **frontend**.

### Integración (`src/frontend/__tests__/integration/`) — 10 tests

Levantan la **app de Express real** (incluyendo los Worker Threads reales del
`WorkerPool`) y la golpean con Supertest, sin mockear el dominio. Cubren los 7 casos
de ejemplo del enunciado (crear, consultar estado, listar, reintentar, URL inválida,
descarga inexistente, validación de reintentos) más casos adicionales de tipo
inválido y campos faltantes.

### E2E (`src/frontend/__tests__/e2e/`) — 5 tests

Automatizan los flujos completos pedidos en la sección 3 del enunciado: crear y
completar una descarga Mock, ver el detalle de una descarga completada, reintentar
una descarga FTP fallida, manejar errores sobre recursos inexistentes, y listar
múltiples descargas con distintos estados.

> **Sobre el uso de Jest + Supertest en lugar de Playwright para E2E:** el enunciado
> menciona Playwright en su sección de configuración opcional, pero la sección
> "Stack Obligatorio → Testing" especifica explícitamente *"E2E: jest supertest
> (automatización de flujos)"*. Se siguió esa instrucción concreta (decisión
> consensuada antes de implementar), automatizando los mismos flujos que recorrería
> un usuario en la UI —crear, hacer polling del estado, listar, reintentar—
> directamente contra la API REST real.

### Notas técnicas relevantes sobre las suites

- Las suites de integración y E2E importan `src/server.ts` directamente, lo cual
  **arranca el `WorkerPool` real con 3 Worker Threads de Node.js** (el mismo
  comportamiento que `npm run dev`). No se mockea ningún componente del dominio.
- Cada Worker Thread carga `ts-node/register` la primera vez que arranca, lo que toma
  varios segundos. Por eso cada suite espera unos 9 segundos de "calentamiento"
  (`esperarCalentamientoWorkers()`) antes de la primera petición; de lo contrario, la
  primera prueba puede fallar por timeout de forma intermitente.
- Las pruebas que requieren una descarga **fallida** usan el tipo `ftp`
  (`DescargadorFtp` falla aleatoriamente ~25% de las veces) y generan lotes de 10
  descargas en paralelo, repitiendo hasta 3 lotes si es necesario
  (`encontrarDescargaFtpFallida` en `helpers/testApp.ts`). Esto mantiene la
  probabilidad de que el test no encuentre ninguna falla por debajo del 0.02%, sin
  necesidad de mockear el dominio para forzar un resultado.
- Integración y E2E usan puertos distintos (3101 y 3102 respectivamente, vía
  `setupFiles`) para poder ejecutarse en paralelo sin choque de puerto, ya que ambas
  importan `server.ts`, que llama a `app.listen(...)` como efecto colateral.
- Se usa `forceExit: true` en la configuración de Jest porque `server.ts` no expone
  el handle del servidor HTTP para cerrarlo explícitamente; los Worker Threads sí se
  destruyen de forma ordenada en cada `afterAll()`.

---

## Decisiones de alcance frente al enunciado

Al implementar el frontend sobre el backend ya entregado (EC2), se encontraron
algunas diferencias entre lo que pide el enunciado de EC3 y lo que el backend
realmente expone. Se optó por ser fiel al comportamiento real del backend en lugar
de simular funcionalidad inexistente:

1. **Botón "Ver detalles"**: el enunciado lo pide, pero no existe un endpoint
   `GET /api/descargas/{id}`. Se implementó como un **modal que reutiliza los datos
   ya disponibles** en la tabla/store (`DownloadCard.vue`), sin hacer una llamada de
   red adicional.

2. **Botón "Cancelar"**: tampoco existe `POST /api/descargas/{id}/cancelar` en el
   backend. El botón se muestra **deshabilitado** en la tabla, con un tooltip que
   explica por qué ("no disponible: el backend aún no expone este endpoint"), en
   lugar de ocultarlo silenciosamente o simular una cancelación que no ocurre
   realmente en el servidor.

3. **Validación de formato de URL al crear una descarga**: el dominio define un
   value object `UrlDescarga` que valida el formato con `new URL(...)`, pero
   `iniciarDercargaUseCase.ts` no lo instancia — crea la entidad `Descarga`
   directamente con el string recibido. En la práctica, **el backend acepta hoy
   cualquier string no vacío como URL**. El frontend sí valida el formato en el
   cliente (`validators.ts`) para dar feedback inmediato, pero esto es una validación
   de UX, no un reflejo de una regla que el backend esté aplicando.

4. **`MaxRetriesExceededException`**: está definida en
   `application/exceptions/maxRetriesExceededException.ts` y mencionada en el
   enunciado ("Esperar excepción MaxRetriesExceededException"), pero no se encontró
   ningún punto del código que la lance: `reintentarDescargaUseCase.ts` solo valida
   que el estado actual sea `FALLIDA`, sin límite de número de reintentos. Se
   documentó esta brecha en lugar de escribir un test que simule un comportamiento
   que el backend no implementa.

5. **Fecha de creación / finalización de la descarga**: las respuestas del backend
   (`DescargaResumen`, `EstadoDescargaResponse`) no incluyen ningún campo de fecha.
   El frontend registra localmente `fechaRegistro` (el momento en que detectó cada
   descarga por primera vez) para poder mostrar una fecha en la tabla y alimentar el
   gráfico de "completadas por hora"; esto es una aproximación del lado del cliente,
   no un dato que provenga del servidor.

6. **Tests unitarios "del backend" en una carpeta del frontend**: el enunciado pide
   tests unitarios de "value objects y demás elementos del backend" dentro de la
   estructura de carpetas del frontend (`src/frontend/__tests__/unit/`). Se mantuvo
   esa ubicación tal como la especifica el enunciado, aunque el código bajo prueba
   (entidades, value objects, excepciones) vive en `src/domain` y `src/application`.

---

## Problemas conocidos y soluciones aplicadas

- **Worker Threads y cold start de `ts-node`**: la primera descarga después de
  levantar el backend puede tardar varios segundos más de lo normal mientras los 3
  Worker Threads terminan de inicializar `ts-node/register`. Esto es transparente en
  uso normal (el usuario no nota un retraso perceptible una vez que el backend lleva
  unos segundos corriendo), pero fue necesario tenerlo en cuenta explícitamente en
  los tests de integración/E2E (ver sección de tests más arriba).
- **Concurrencia limitada a 3 workers** (`MAX_CONCURRENT_WORKERS` en
  `src/shared/config.ts`): si se crean muchas descargas a la vez, las que excedan
  ese límite permanecen en estado `PENDIENTE` hasta que se libera un worker. La UI
  refleja esto correctamente gracias al polling, sin necesidad de cambios
  adicionales.
- **CORS en desarrollo**: resuelto mediante el proxy de Vite (`vite.config.ts`)
  en lugar de habilitar CORS de forma permisiva en el backend, para no modificar el
  middleware de CORS ya provisto por la cátedra.
