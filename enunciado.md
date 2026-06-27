# 📋 Enunciado de la Prueba Técnica

## Simulador de Descargas Concurrentes con DDD

### 🎯 Objetivo General

Desarrollar un sistema de descarga de archivos que simule la obtención de recursos desde diferentes fuentes (HTTP, FTP, Mock), procesándolos de manera concurrente utilizando **Worker Threads** de Node.js. El sistema debe exponer una API REST documentada con Swagger y seguir los principios de **Domain-Driven Design (DDD)**.

---

### 📚 Contexto del Negocio

Una empresa necesita un sistema que permita descargar múltiples archivos desde diferentes orígenes simultáneamente. Cada descarga puede fallar por diversas razones (timeout, archivo no encontrado, error de servidor), por lo que el sistema debe ser robusto, permitir reintentos y mantener un registro del estado de cada operación.

El sistema debe ser capaz de:
- Iniciar múltiples descargas en paralelo
- Gestionar diferentes protocolos de descarga
- Reintentar descargas fallidas automáticamente
- Proporcionar información en tiempo real del estado de cada descarga
- Escalar horizontalmente usando workers para no bloquear el event loop

---

### 🏗️ Arquitectura Requerida

Debes implementar una arquitectura basada en **DDD (Domain-Driven Design)** con las siguientes capas:

```
src/
├── domain/              # ← TU FOCO PRINCIPAL (capa de dominio)
├── application/         # ← Casos de uso (orquestación)
├── infrastructure/      # ← Workers, servicios concretos, repositorios
├── interfaces/          # ← Controladores, rutas (YA PROVEÍDO)
└── shared/              # ← Utilidades comunes (YA PROVEÍDO PARCIALMENTE)
```

**Importante:** Los endpoints de Express, Swagger, y la estructura base de rutas ya están creados. **Tu trabajo se centrará en implementar la lógica de dominio, los casos de uso, los workers y la gestión de concurrencia.**

---

### ✅ Requisitos Obligatorios por Concepto

#### 1. POO: Clases Abstractas y Métodos Abstractos (20%)

Debes crear una **clase abstracta `DescargadorBase`** que:
- Declare un método abstracto `descargar(url: string): Promise<Buffer>`
- Implemente un método concreto `ejecutarConReintento<T>(fn: () => Promise<T>, maxIntentos: number): Promise<T>` que maneje la lógica de reintentos con backoff exponencial
- Incluya un método protegido `validarUrl(url: string): boolean` con validación básica

**Evaluación:**
- ¿La clase es correctamente abstracta?
- ¿El método abstracto está bien definido?
- ¿El método concreto reutiliza lógica común?

---

#### 2. Interfaces (15%)

Debes definir e implementar las siguientes interfaces:

```typescript
// Interfaz para elementos que pueden almacenarse en caché
interface ICacheable {
  obtenerClaveCache(): string;
  guardarEnCache(data: Buffer): void;
  recuperarDeCache(): Buffer | null;
}

// Interfaz para elementos que generan reportes
interface IReportable {
  generarReporte(): {
    id: string;
    estado: string;
    intentos: number;
    tiempoTotal: number;
  };
}

// Interfaz para descargables (polimorfismo)
interface IDescargable {
  descargar(url: string): Promise<Buffer>;
  cancelar(): void;
  getProgreso(): number;
}
```

**Evaluación:**
- ¿Todas las interfaces están implementadas correctamente?
- ¿Se utiliza el tipado fuerte de TypeScript?

---

#### 3. Polimorfismo (20%)

Debes implementar **al menos 3 clases concretas** que extiendan de `DescargadorBase`:

- `DescargadorHTTP`: Simula descarga HTTP (usar `axios` o `fetch` con timeout configurable)
- `DescargadorFTP`: Simula descarga FTP (puede ser un mock con setTimeout que falle aleatoriamente)
- `DescargadorMock`: Para pruebas, retorna un buffer fijo con datos simulados

Además, debes implementar una **Factory** que decida qué tipo de descargador instanciar según el parámetro `tipo` recibido desde la API.

**Evaluación:**
- ¿Los tres descargadores tienen comportamientos diferentes pero misma interfaz?
- ¿La Factory permite cambiar el comportamiento sin modificar el cliente?
- ¿Se demuestra sustitución de Liskov?

---

#### 4. Manejo de Errores (20%)

Debes implementar una jerarquía de **errores personalizados**:

```typescript
// Clase base
class ErrorDescarga extends Error {
  constructor(message: string, public readonly codigo: string) {}
}

// Errores específicos
class ErrorTimeout extends ErrorDescarga { ... }
class ErrorNotFound extends ErrorDescarga { ... }
class ErrorServidor extends ErrorDescarga { ... }
class ErrorMaxReintentos extends ErrorDescarga { ... }
```

Reglas de negocio:
- Timeout después de 5 segundos → lanzar `ErrorTimeout`
- URL con 404 → lanzar `ErrorNotFound`
- Error 500 del servidor → lanzar `ErrorServidor`
- Después de 3 reintentos fallidos → lanzar `ErrorMaxReintentos`

**Evaluación:**
- ¿Se capturan errores específicos y se manejan diferencialmente?
- ¿Los errores tienen información contextual suficiente?
- ¿Hay logging adecuado de cada error?

---

#### 5. Hilos y Concurrencia (20%)

Debes implementar un **sistema de workers** que:

- Cree un pool de **3 workers** al iniciar la aplicación
- Cada worker ejecute tareas de descarga de forma aislada
- El hilo principal encole las solicitudes de descarga
- Los workers se comuniquen con el hilo principal mediante mensajes (`postMessage`/`on('message')`)
- Se permita **máximo 3 descargas simultáneas** (las demás esperan en cola)

Estructura mínima:

```typescript
// Worker (infrastructure/workers/descargaWorker.ts)
// Debe recibir { id, url, tipo, maxReintentos }
// Devolver { success, data, error } según corresponda

// WorkerPool (shared/utils/workerPool.ts)
// Debe gestionar la distribución de tareas y la cola
```

**Evaluación:**
- ¿Se usan correctamente los Worker Threads?
- ¿El sistema no se bloquea con muchas descargas concurrentes?
- ¿La comunicación hilo-principal ↔ worker es eficiente?
- ¿Se evitan race conditions?

---

#### 6. TypeScript y Buenas Prácticas (5%)

- Uso estricto de tipos (no usar `any` sin justificación)
- Configuración `strict: true` en `tsconfig.json`
- Código asíncrono con `async/await`
- Separación clara de responsabilidades por capas

---

### 🚀 Funcionalidades Específicas a Implementar

#### Endpoints (YA PROVEÍDOS, pero debes conectar la lógica)

| Método | Endpoint | Descripción | Lo que debes implementar |
|--------|----------|-------------|--------------------------|
| POST | `/api/descargas` | Iniciar nueva descarga | Handler que crea entidad `Descarga` y la encola en worker |
| GET | `/api/descargas/{id}/estado` | Consultar estado | Handler que consulta repositorio y retorna estado actual |
| POST | `/api/descargas/{id}/reintentar` | Reintentar manualmente | Handler que reinicia proceso de descarga |
| GET | `/api/descargas` | Listar todas | Handler que retorna todas las descargas creadas |

#### Estados de una descarga

La entidad `Descarga` debe transitar por estos estados:

```
PENDIENTE → EN_PROGRESO → COMPLETADA
                        ↘ FALLIDA → REINTENTANDO (si aplica)
```

---

### 📊 Criterios de Evaluación Detallados

| Criterio | Peso | Excelente (90-100%) | Aceptable (70-89%) | Insuficiente (<70%) |
|----------|------|---------------------|--------------------|--------------------|
| **Clases abstractas** | 20% | Usa abstract class correctamente, métodos abstractos bien definidos, código reutilizable | Solo clase abstracta básica | No usa abstract class o mal implementada |
| **Interfaces** | 15% | Todas implementadas, tipado fuerte, uso creativo | Implementación mínima | No las usa o tipado débil |
| **Polimorfismo** | 20% | 3+ implementaciones, Factory correcta, cambio dinámico de comportamiento | 2 implementaciones | Solo 1 implementación |
| **Manejo errores** | 20% | Jerarquía completa, reintentos, logging, errores específicos | Solo try/catch básico | No maneja errores |
| **Concurrencia** | 20% | Pool funcional, cola, comunicación efectiva, sin bloqueos | Worker simple | No usa workers o mal implementado |
| **TypeScript** | 5% | `strict: true`, sin `any`, tipos precisos | Algunos `any` | Tipado deficiente |

---

### 🧪 Escenarios de Prueba (deben pasar)

Tu implementación debe superar estos casos:

1. **Descarga exitosa:** POST a `/api/descargas` con `{ "url": "https://ejemplo.com/file.pdf", "tipo": "http" }` → debe retornar 201 y la descarga debe completarse en menos de 5 segundos

2. **Descarga fallida por timeout:** URL que tarde más de 5 segundos → debe lanzar `ErrorTimeout` y la descarga debe quedar en estado `FALLIDA`

3. **Reintento automático:** Descarga que falla las primeras 2 veces y funciona la tercera → el sistema debe reintentar automáticamente (máx 3) y marcar como `COMPLETADA` si éxito

4. **Concurrencia:** Iniciar 10 descargas simultáneas → solo 3 deben estar en progreso activo, las demás en cola; al completarse una, debe iniciarse la siguiente automáticamente

5. **Polimorfismo:** Cambiar el `tipo` de descargador entre `http`, `ftp` y `mock` → debe usar implementación diferente cada vez

6. **Manejo de errores específico:** Probar con URL `https://api.ejemplo.com/404` → debe lanzar `ErrorNotFound` y mensaje específico

---

### 📦 Entregables Esperados

1. **Código fuente completo** (estructura DDD)
2. **Archivo `.env`** con variables de configuración (puerto, max workers, timeout, etc.)
3. **Colección de Postman** o ejemplos de uso de la API
4. **Pequeño README** con instrucciones de:
   - Instalación
   - Ejecución (desarrollo y producción)
   - Endpoints disponibles
   - Ejemplos de peticiones

---

### ⏱️ Tiempo Estimado

- **Setup inicial:** 30 minutos
- **Implementación de dominio (entidades, VO, interfaces, abstract):** 1.5 horas
- **Implementación de servicios concretos y Factory:** 1 hora
- **Implementación de workers y concurrencia:** 1.5 horas
- **Manejo de errores y logging:** 1 hora
- **Pruebas y ajustes:** 1 hora

**Total estimado:** 6-7 horas

---

### 💡 Tips para el Desarrollo

1. **Empieza por el dominio:** Define primero `Descarga` (entidad), `UrlDescarga` (value object), `EstadoDescarga` (enum/value object)

2. **Luego los errores:** Crea la jerarquía de `ErrorDescarga`

3. **Luego la clase abstracta `DescargadorBase`** con la lógica de reintentos

4. **Luego implementa los 3 descargadores concretos** (HTTP real, FTP mock, Mock)

5. **Luego la Factory**

6. **Luego los handlers** de aplicación (usan los workers)

7. **Finalmente el WorkerPool y los workers**

8. **Usa console.log o un logger simple** para debuggear la concurrencia

---

### 🚫 Restricciones

- **No usar librerías externas** para workers (Node.js ya incluye `worker_threads`)
- **No usar `any`** a menos que esté justificado con comentario
- **No modificar los archivos de rutas y controladores provistos** (a menos que sea estrictamente necesario)
- **No eludir la arquitectura DDD** (no poner lógica de negocio en controladores)

---

### 🌟 Bonus (opcional, puntos extra)

- Implementar **caché en memoria** para descargas exitosas (usar interfaz `ICacheable`)
- Implementar **endpoint de reporte** que use `IReportable` para generar estadísticas
- Agregar **sistema de progreso** (0-100%) actualizado en tiempo real
- Hacer que los workers puedan **cancelar** una descarga en progreso

---

### 📝 Resumen de lo que TÚ tienes que hacer

| Sí, tú implementas | Ya está provisto |
|-------------------|------------------|
| ✅ Entidades y Value Objects | ✅ Rutas Express |
| ✅ Clases abstractas | ✅ Swagger configurado |
| ✅ Interfaces | ✅ Controladores base |
| ✅ Descargadores concretos (HTTP, FTP, Mock) | ✅ Middleware de validación |
| ✅ Factory de descargadores | ✅ Estructura de carpetas |
| ✅ Jerarquía de errores | ✅ Package.json (dependencias básicas) |
| ✅ Workers y WorkerPool | ✅ server.ts |
| ✅ Handlers de casos de uso | ✅ |
| ✅ Lógica de concurrencia | ✅ |
| ✅ Reintentos y manejo de fallos | ✅ |

---

¿Necesitas que profundice en alguna parte específica, o que te genere el **código base de los archivos ya provistos** (rutas, controladores, swagger) para que solo tengas que implementar el dominio?