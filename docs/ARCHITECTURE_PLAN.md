# AZUL CEREZO — Plan de arquitectura inicial

Estado: decisiones operativas 1–10 aprobadas. Billing, pagos y sales tax siguen abiertos.  
Alcance de este documento: decisiones de arquitectura. No incluye schema de Prisma, código, migraciones ni módulos.

CRM_Base (`D:\Software\CRM Base`) es un proyecto independiente de GYPSA. Permanece intacto. Azul Cerezo no lo importa ni lo enlaza en tiempo de ejecución. Sirve solo como referencia de patrones técnicos.

---

## 1. Objetivo y alcance

Azul Cerezo es el sistema web de operación de una empresa de limpieza profesional. La primera empresa en la plataforma es Azul Cerezo, cargada como datos del tenant.

La plataforma nace multi-tenant para poder alojar más empresas después, sin convertir el nombre, la marca ni las reglas de Azul Cerezo en código.

Contexto operativo del primer tenant:

| Dato | Valor |
|---|---|
| País | USA |
| Estado | Florida |
| Moneda | USD |
| Zona horaria | `America/New_York` |
| Idioma de la interfaz | Español |

Esos valores viven en la configuración de la empresa. El código los lee; no los asume.

El sistema cubre el ciclo comercial y operativo: solicitud de cotización, evaluación de la propiedad cuando haga falta, cotización revisada por el equipo, aceptación, servicio contratado, visitas, ejecución, evidencias, cancelaciones, reclamos y cobro.

Queda fuera de este corte el portal del cliente, WhatsApp, pasarelas de pago, facturación fiscal, análisis de fotografías con IA y el almacenamiento productivo en OCI Object Storage o S3. La arquitectura deja sitio para incorporarlos sin rehacer el dominio.

## 2. Principios arquitectónicos

1. **Monolito modular.** Una aplicación web, una API y una base PostgreSQL. Un equipo pequeño puede desarrollarlo y mantenerlo.
2. **Multi-tenant desde el inicio.** Una base, un schema, aislamiento por `companyId`.
3. **La empresa es datos.** Azul Cerezo se crea por seed y configuración. No hay ramas `if (empresa === "azul-cerezo")`.
4. **Tres capas en el mismo repositorio.** Core, módulos comunes y vertical de limpieza. Sin plataforma de plugins.
5. **El centro operativo es el servicio contratado y sus visitas.** El lead existe solo mientras la persona todavía no es cliente.
6. **Las reglas de negocio configurables viven en datos.** Porcentajes de cancelación, ventana, buffer, duraciones de referencia, fotos y el umbral que sugiere volver a una limpieza inicial se guardan por empresa.
7. **Los números de operación son guía, no precio.** Duración, fotos y tipo de limpieza no alimentan un motor de tarifas.
8. **Copiar patrones, no acoplar proyectos.** De CRM_Base se adaptan piezas de infraestructura. El dominio de VR Consultorías no entra.
9. **Extraer un paquete GYPSA cuando exista un segundo producto.** Hasta entonces el core vive dentro de este repositorio.

## 3. Arquitectura general

```text
Navegador del equipo interno
        │
        ▼
apps/web     React + Vite + Tailwind + JavaScript
        │    HTTPS, JSON, Bearer JWT
        ▼
apps/api     Express
        │    rutas → controladores → servicios
        │    Prisma
        ▼
PostgreSQL   un schema, filas con companyId

Almacenamiento de archivos
        │
        File (metadato de dominio)
        │
        StorageProvider
          ├─ LocalStorage      desarrollo
          └─ ObjectStorage     OCI Object Storage o S3, más adelante
```

Azul Cerezo es un solo despliegue. El formulario público de solicitud vive en la misma aplicación web. El portal del cliente y las integraciones se agregan después sobre los mismos módulos.

Comunicación interna: llamada directa entre servicios del monolito. No hay bus de eventos ni microservicios.

## 4. Estructura del monorepo

```text
azul-cerezo/
  apps/
    web/
      src/
        app/                    router, layout, providers
        components/ui/          Button, Input, Card, Toast, Badge
        features/
          auth/
          clients/
          leads/
          quotes/
          properties/
          services/
          visits/
          workers/
          billing/
        lib/                    apiClient, tokenStorage
    api/
      src/
        config/
        middlewares/            auth, permission, error, rate-limit
        modules/
          core/                 companies, users, memberships, audit, files, settings
          commercial/           clients, contacts, leads, quote-requests, quotes
          cleaning/             properties, offerings, services, visits, workers,
                                checklists, assessments, claims
          billing/              charges, payments, expenses, cancellation fees
        storage/                interfaz y proveedor local
        utils/
  packages/
    database/
      prisma/schema.prisma     un archivo, secciones por capa
      prisma/seed.js
  docs/
    ARCHITECTURE_PLAN.md
  docker-compose.yml
  package.json                  npm workspaces
```

Workspaces previstos: `@azul/web`, `@azul/api`, `@azul/database`.

Stack, alineado con CRM_Base para poder copiar patrones con poca fricción:

- Node.js 20+
- React + Vite + Tailwind
- Express
- Prisma + PostgreSQL 16
- JWT, bcrypt, Zod, Helmet
- JavaScript

## 5. Separación Core / Common / Cleaning Vertical

### Core

Identidad, acceso y plataforma. Sin vocabulario de limpieza.

- Company
- User
- Membership
- Role y catálogo de permisos
- Authentication
- AuditLog
- CompanySetting
- Notification (registro in-app)
- File y StorageProvider

### Módulos comunes

Comercial y administración reutilizables por otro negocio GYPSA más adelante.

- Client
- Contact
- Address
- Lead
- QuoteRequest
- Quote y QuoteLine
- Reportes como consultas, no como un constructor genérico

Charge, Payment y Expense pertenecen al módulo de billing y siguen sin diseño aprobado (sección 16).

### Vertical de limpieza

Operación de campo de este producto.

- Property
- ServiceOffering (catálogo de lo que la empresa ofrece)
- Service (servicio contratado para un cliente y una propiedad)
- Visit
- Recurrencia, expresada en el Service y materializada en Visits
- Worker, Team, Assignment
- PropertyAssessment (evaluación previa a cotizar)
- ChecklistTemplate, ChecklistRun
- VisitPhoto
- Incident
- Claim

### Configuración de Azul Cerezo

Solo seed y settings de esa empresa: razón social, nombre comercial, teléfono, correo, país `US`, estado `FL`, moneda `USD`, zona `America/New_York`, idioma de interfaz `es`, color, políticas y catálogo inicial. El slug previsto es `azul-cerezo`.

La configuración de la empresa no fija una ciudad. País y estado describen dónde opera el tenant. Cada dirección de cliente o propiedad es un dato propio.

## 6. Multi-tenancy

Estrategia: **base compartida, schema compartido, `companyId` en cada fila de negocio**.

- `User` es la identidad global. El email es único en toda la plataforma.
- `Membership` une usuario y empresa, con un rol.
- El JWT lleva `userId` y la empresa activa.
- La primera versión opera con una sola empresa. El modelo admite una segunda sin nuevo despliegue: insertar `Company`, settings, roles y un owner.
- Folios, teléfonos de cliente y slugs de catálogo son únicos por empresa.
- Cada servicio de aplicación recibe `companyId` y filtra con `where: { companyId }` visible en el código. Un filtro oculto dentro de Prisma se evita: es más difícil de revisar.
- No hay consola de superadmin de GYPSA en este corte. Un indicador de administrador de plataforma puede agregarse cuando exista una segunda empresa.

Fechas de negocio (día de visita, ventana) se interpretan en la zona de la empresa. Los instantes (`actualStartedAt`, auditoría, pagos) se guardan en UTC.

## 7. Autenticación y autorización

Flujo:

1. `POST /auth/login` con email y contraseña. La contraseña se guarda con bcrypt.
2. JWT de acceso, vida corta, con el usuario y la empresa activa.
3. `requireAuth` carga usuario, membresía activa y permisos de esa empresa.
4. Usuario inactivo o membresía inactiva no entra.
5. `requirePermission("quotes.send")` protege la acción.

Los permisos son un catálogo fijo en código. Los roles se siembran por empresa y apuntan a ese catálogo. La primera versión no incluye pantalla para inventar permisos.

| Rol | Uso |
|---|---|
| `OWNER` | Dueño de la empresa |
| `ADMIN` | Configuración, usuarios y envío de cotizaciones |
| `COORDINATOR` | Cotizaciones en borrador, agenda, asignación |
| `WORKER` | Reservado para un acceso de campo posterior. En el MVP no se asigna a ninguna cuenta |
| `CLIENT` | Reservado para el portal. Sin pantallas en este corte |

Permisos previstos, a afinar al implementar:

- `clients.read` / `clients.write`
- `quotes.read` / `quotes.write` / `quotes.review` / `quotes.send`
- `visits.read` / `visits.assign` / `visits.execute` / `visits.cancel`
- `billing.read` / `billing.write`
- `users.manage`
- `settings.manage`

`Worker` y `User` son entidades distintas. En el MVP el trabajador no tiene cuenta ni inicia sesión: el equipo interno lo asigna y registra la ejecución. `Worker.userId` queda vacío en este corte y solo servirá, más adelante, para enlazar una `Membership` con rol `WORKER`.

Tokens de refresco, SSO y magic link quedan fuera de este corte.

## 8. Modelo conceptual de dominio

### Nombre del servicio contratado

`ServiceOrder` no se usa. “Order” sugiere un pedido de una sola ejecución y se confunde con la visita del día.

| Concepto | Nombre | Responsabilidad |
|---|---|---|
| Lo que la empresa ofrece | `ServiceOffering` | Catálogo: “limpieza inicial”, “mantenimiento recurrente”. |
| Lo contratado para un cliente y una propiedad | `Service` | Configuración viva: frecuencia, estado, tipo por defecto de las visitas. Genera visitas. |
| Una ejecución en una fecha | `Visit` | Ventana prometida, equipo, checklist, fotos, inicio y fin reales. |

Ejemplo:

```text
Service  "Weekly cleaning — 123 Oak St"
  frequency: WEEKLY
  ├─ Visit  Oct 5   10:00–12:00
  ├─ Visit  Oct 12  10:00–12:00
  ├─ Visit  Oct 19  10:00–12:00
  └─ Visit  Oct 26  10:00–12:00
```

Un trabajo de una sola vez es un `Service` con frecuencia `ONE_TIME` y una sola `Visit`.

### Entidades e independencia comercial

`Lead`, `Client`, `QuoteRequest` y `Quote` son conceptos distintos.

| Entidad | Significado |
|---|---|
| `Lead` | Prospecto interesado que todavía no es cliente. |
| `Client` | Cliente establecido. |
| `QuoteRequest` | Una solicitud concreta de cotización. |
| `Quote` | La propuesta económica preparada a partir de una solicitud. |

Reglas:

- Una solicitud de un prospecto lleva `leadId`. `clientId` se llena al convertirlo.
- Una solicitud de un cliente existente lleva `clientId` y `propertyId`. `leadId` queda vacío. No se crea otro lead.
- Una solicitud puede tener varias cotizaciones (reenvíos o alternativas). Cada cotización tiene su propio ciclo de estados.
- Aceptar una cotización de un lead crea el `Client`, el contacto y la propiedad si aún no existen, marca el lead como ganado y crea el `Service`.

### Dirección

`Address` es genérica. No depende de una ciudad fija de Azul Cerezo.

| Campo | Uso |
|---|---|
| `line1` | Calle y número |
| `line2` | Apartamento, suite u otra línea, opcional |
| `city` | La ciudad que corresponda a esa dirección |
| `stateRegion` | Estado o región |
| `postalCode` | Código postal |
| `country` | País |

La empresa opera en Florida, USA, y el formulario público puede preseleccionar país `US` y estado `FL` desde sus settings. La ciudad no tiene valor por defecto. Lo que se guarda es lo que se envió en esa dirección.

### Captura del cliente y alcance del coordinador

En `QuoteRequest` conviven dos bloques. El segundo no pisa al primero.

**Lo que captura el cliente** (`clientInput`), en el formulario público o en una captura asistida:

- Nombre, teléfono y correo
- Dirección genérica del lugar a limpiar
- Mensaje libre: qué necesita
- Lo que el cliente puede saber de su casa: habitaciones, baños, mascotas, niños y, si la indica, la frecuencia deseada

Ese bloque queda como snapshot de lo enviado.

**Lo que completa después el coordinador** (`operationalScope`):

- Pies cuadrados, condición, áreas y cocinas
- Electrodomésticos, horno doble, refrigerador y gabinetes
- Objetos, lámparas, ventiladores, ventanas accesibles, trabajo debajo de muebles y otros extras
- Si la solicitud requiere evaluación (`requiresAssessment`)
- Notas comerciales

Las `QuoteLine` también las escribe el equipo, no el formulario público. El vocabulario del alcance sigue siendo extensible. El cliente no tiene que conocer sqft ni el detalle de gabinetes, lámparas o ventiladores para enviar la solicitud.

### Tipo de limpieza

Cada `Visit` tiene `visitKind`:

| Kind | Uso |
|---|---|
| `INITIAL` | Primera limpieza, o limpieza después de una brecha larga. |
| `MAINTENANCE` | Visita de mantenimiento dentro de la recurrencia. |
| `CORRECTION` | Revisita por un reclamo. |

Regla cerrada del `Service` recurrente: la primera visita nace `INITIAL` y las siguientes nacen `MAINTENANCE`. Las dos se pueden editar después.

Si al generar una visita siguiente han pasado al menos `recurrence.gapResetDays` (45) desde la última visita `COMPLETED`, el sistema **sugiere** `INITIAL`. La visita se crea igual como `MAINTENANCE` y lleva `kindSuggestion = INITIAL` con motivo `GAP_THRESHOLD`. El coordinador acepta la sugerencia o la descarta. Aceptarla cambia `visitKind`, queda auditado y no es automático.

Esos kinds afectan duración estimada, checklist y fotos. No definen el precio.

Referencias operativas, guardadas como settings de la empresa y copiadas a la visita al crearla. El coordinador puede editar la visita. El precio no las lee.

| Kind | Duración de referencia | Fotos |
|---|---|---|
| `INITIAL` | 4 a 6 horas | `BEFORE` y `AFTER` esperadas |
| `MAINTENANCE` | 3 a 4 horas, o menos | No obligatorias |

La visita guarda su propia copia: `estimatedDurationMinutes`, `photosRequired` y los kinds de foto esperados. Cambiar el setting después no reescribe visitas ya creadas.

El checklist se elige por `visitKind`. En el MVP hay plantillas sembradas, no un motor de reglas.

### Evaluación previa

`PropertyAssessment` es una entidad propia, ligada a una `QuoteRequest`. Tiene fecha, ventana, responsable, notas y estado (`SCHEDULED`, `DONE`, `CANCELLED`, `WAIVED`).

No es una `Visit`. No comparte checklist de servicio, fotos de ejecución ni cobro. Sí aparece en la agenda.

`QuoteRequest.requiresAssessment` indica si esa solicitud necesita evaluación. Puede ser verdadero o falso desde el alta, y el coordinador puede cambiarlo mientras la cotización no se haya enviado.

### Ventana y ejecución real

En `Visit` y en `PropertyAssessment`:

| Campo | Significado |
|---|---|
| `scheduledDate` | Día prometido, en la zona de la empresa. |
| `windowStart` | Inicio de la ventana prometida. |
| `windowEnd` | Fin de la ventana prometida. |
| `actualStartedAt` | Momento real en que empezó el trabajo. Vacío hasta entonces. |
| `actualEndedAt` | Momento real en que terminó. |

Ejemplo de lo que ve el cliente: October 8 — 10:00 AM–12:00 PM.  
La ventana por defecto es de 2 horas (`defaultWindowMinutes = 120`). Cada cita puede usar otra.

La política de cancelación mide las horas que faltan hasta `windowStart`. No usa `windowEnd` ni el inicio real del trabajo.

### Cancelación configurable

Los porcentajes no viven en código.

```text
CancellationPolicy          una por empresa
  enabled                   se puede apagar
  reference                 WINDOW_START

CancellationPolicyTier
  upToHours                 24, 72, o vacío para el resto
  feePercent
  sortOrder
```

Política inicial de Azul Cerezo, como datos sembrados. `h` son las horas que faltan hasta `windowStart`:

| Condición | Cargo |
|---|---|
| `h > 72` | 0 % |
| `24 < h <= 72` | 40 % |
| `h <= 24` | 100 % |

Quedan cerrados los bordes: exactamente 72 horas es 40 %; exactamente 24 horas es 100 %.

Al cancelar una visita el sistema calcula el porcentaje y guarda el resultado junto con las horas restantes. Convertir ese porcentaje en un cobro exigible pertenece a las reglas de billing, todavía abiertas.

Excepción por visita: un usuario con permiso puede sustituir el porcentaje calculado. La fila de cancelación conserva el porcentaje de la política, el porcentaje aplicado, el motivo y quién lo cambió.

Apagar la política en la empresa hace que el cálculo dé 0 %, salvo una excepción manual.

Terminar un `Service` detiene visitas futuras. Cada visita ya agendada se cancela por separado, con su propio cálculo. Así un mismo contrato no recibe un único porcentaje ciego.

### Reclamos y revisitas

Modelo flexible, a la espera de confirmar detalles con Sylvia:

```text
Claim
  visitId
  openedAt
  description
  status          OPEN | REVISIT_SCHEDULED | RESOLVED | DISMISSED
  revisitVisitId  Visit de kind CORRECTION, si se agenda
```

La ventana de aviso de un problema sigue como referencia de 24 horas (`claims.windowHours`), editable, y no está cerrada como regla de cobro.

Qué pasa con el dinero después del servicio está abierto. Sylvia lo confirma primero; el CPA confirma después el impuesto. Hasta entonces el modelo solo reserva el lugar: un `Claim` puede apuntar a una revisita `CORRECTION`, y el billing futuro podrá retener un saldo o no. Esos comportamientos no forman parte de las decisiones aprobadas.

### Precio de la cotización

La cotización es manual. No hay motor automático de tarifas ni una fórmula basada solo en pies cuadrados.

`clientInput` conserva lo que envió el cliente. `operationalScope` es el contexto que el coordinador completa para cotizar. Los dos son JSON con vocabulario conocido, ampliables sin migración. El alcance operacional incluye:

`areas`, `sqft`, `condition`, `kitchens`, `appliances`, `doubleOven`, `refrigerator`, `cabinets`, `objects`, `lamps`, `fans`, `accessibleWindows`, `underFurniture`, `extras`.

Habitaciones, baños, mascotas, niños y la frecuencia deseada llegan en `clientInput` cuando el cliente los indicó. El coordinador puede precisarlas en el alcance operacional sin borrar el original.

`QuoteLine` es lo que se cobra: descripción, cantidad, unidad, precio unitario e importe. La línea la escribe una persona del equipo. Puede representar un área, un extra o la mano de obra. Ni `clientInput` ni `operationalScope` calculan la línea.

La moneda de la cotización sale de la empresa (`USD`).

### Archivos

El dominio referencia `fileId`. Nadie guarda una ruta de disco en `VisitPhoto`, `ChecklistRun` o `Incident`.

```text
File
  id
  companyId
  storageProvider     LOCAL | S3 | OCI
  storageKey
  mimeType
  size
  originalName
  uploadedById
  createdAt
```

### Relaciones principales

```text
Company 1──* Membership *──1 User
Company 1──* Role 1──* RolePermission

Lead 1──* QuoteRequest *──0..1 Client
QuoteRequest *──0..1 Property
QuoteRequest 1──* Quote 1──* QuoteLine
QuoteRequest 0..1── PropertyAssessment

Quote (aceptada) 0..1── Service
Service *──1 Client
Service *──1 Property
Service 1──* Visit
Visit *──* Worker          vía Assignment
Visit 1──* ChecklistRun
Visit 1──* VisitPhoto *──1 File
Visit 0..1── Claim 0..1── Visit (revisita)

Billing (Charge, Payment): relación reservada, todavía no aprobada.
```

### Estados

| Entidad | Estados |
|---|---|
| Lead | `NEW`, `CONTACTED`, `QUOTED`, `WON`, `LOST` |
| QuoteRequest | `RECEIVED`, `WAITING_ASSESSMENT`, `READY_TO_QUOTE`, `QUOTED`, `CLOSED`, `CANCELLED` |
| Quote | `DRAFT`, `IN_REVIEW`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED` |
| PropertyAssessment | `SCHEDULED`, `DONE`, `CANCELLED`, `WAIVED` |
| Service | `ACTIVE`, `PAUSED`, `ENDED` |
| Visit | `SCHEDULED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SKIPPED` |
| Claim | `OPEN`, `REVISIT_SCHEDULED`, `RESOLVED`, `DISMISSED` |

Los estados de un cargo (`PENDING`, `HELD`, `DUE`, `PAID`, `WAIVED`) son solo un vocabulario posible. No están aprobados.

## 9. Flujos principales

### Prospecto nuevo

```text
Solicitud pública o captura interna
        │  Lead NEW + QuoteRequest RECEIVED
        ▼
Triage
        │  requiresAssessment = sí o no
        ├─ sí  → PropertyAssessment en agenda
        │         WAITING_ASSESSMENT → DONE → READY_TO_QUOTE
        └─ no  → READY_TO_QUOTE
        ▼
Quote en DRAFT
        │  el coordinador completa operationalScope y arma líneas
        ▼
IN_REVIEW
        │  revisión interna
        │  puede volver a DRAFT
        ▼
SENT                         solo con permiso quotes.send
        │                    bloqueado si la evaluación sigue pendiente
        │                    salvo dispensa explícita y auditada
        │
        ├─ REJECTED / EXPIRED
        └─ ACCEPTED
              │  crea Client, Contact, Property
              │  Lead WON
              │  crea Service + visitas según la frecuencia
              ▼
           Asignación → ejecución → checklist / fotos → COMPLETED
              │
              ▼
           Cobro: reglas aún abiertas (ver sección 16)
```

Nada en este flujo pasa una cotización a `SENT` por sí solo. Crear la cotización la deja en `DRAFT`.

Si `requiresAssessment` está activo, enviar exige una `PropertyAssessment` en `DONE` o una dispensa explícita en `WAIVED`. La dispensa pide permiso, motivo y queda en auditoría. Sin eso, `POST /quotes/:id/send` no procede.

El envío solo lo puede hacer quien tiene el permiso `quotes.send`. El rol no basta por su nombre.

### Cliente existente

```text
Client + Property
        │
        ▼
QuoteRequest con clientId, sin Lead
        │
        ▼
mismo camino: evaluación si aplica → DRAFT → IN_REVIEW → SENT → ACCEPTED
        │
        ▼
nuevo Service, o ajuste del Service ya activo
```

### Ejecución de una visita

```text
Visit SCHEDULED
  scheduledDate + windowStart + windowEnd     lo prometido al cliente
        │
        ▼
ASSIGNED
        │
        ▼
IN_PROGRESS
  actualStartedAt
  ChecklistRun según visitKind
  VisitPhoto si la visita lo exige
  Incident si algo ocurre en sitio
        │
        ▼
COMPLETED
  actualEndedAt
        │
        ├─ Claim, si el cliente reporta un problema
        │     puede originar una Visit CORRECTION
        └─ Cobro del saldo: pendiente de confirmar con Sylvia
```

Completar una visita `INITIAL` con fotos obligatorias exige las fotos configuradas en esa visita (`BEFORE` y `AFTER` en la referencia inicial). Una visita `MAINTENANCE` puede completarse sin fotos cuando su copia dice que no son obligatorias.

### Recurrencia y brecha

Un `Service` semanal, quincenal o mensual genera varias `Visit`. En el MVP el coordinador las genera a mano hasta una fecha. La fecha que ofrece la interfaz, como punto de partida, es hoy más 8 semanas. Puede elegir otra. No hay cron.

La primera visita del servicio nace `INITIAL`. Las siguientes nacen `MAINTENANCE`. Si la última visita `COMPLETED` queda a 45 días o más, la nueva visita sigue naciendo `MAINTENANCE` y muestra la sugerencia de pasarla a `INITIAL`. Una visita `SKIPPED` o `CANCELLED` no cuenta como servicio recibido.

### Cancelación de una visita

```text
Horas hasta windowStart
        │
        ▼
Política activa de la empresa → porcentaje
        │
        ├─ se aplica ese porcentaje
        └─ excepción manual en esa visita → otro porcentaje, con motivo y autor
        ▼
Charge por cancelación: el porcentaje ya está decidido;
el momento y la forma de cobro siguen abiertos (sección 16)
```

## 10. API

JSON sobre HTTPS. Rutas autenticadas exigen Bearer token. El `companyId` sale del token, no del cuerpo de la petición.

Prefijos:

| Prefijo | Uso |
|---|---|
| `/auth` | Login y sesión |
| `/api/public/:companySlug/quote-requests` | Alta pública de solicitud |
| `/api/core` | Perfil, usuarios, settings, auditoría, archivos |
| `/api/commercial` | Clientes, contactos, leads, solicitudes, cotizaciones |
| `/api/cleaning` | Propiedades, servicios, visitas, agenda, checklists, reclamos |
| `/api/billing` | Reservado. Sin contrato hasta cerrar la sección 16 |

Acciones que son transiciones, no un CRUD genérico:

- `POST /quote-requests/:id/assessment` — programar evaluación
- `POST /assessments/:id/complete` y `POST /assessments/:id/waive`
- `POST /quote-requests/:id/quotes` — crea una `Quote` en `DRAFT`
- `POST /quotes/:id/submit-review` — `DRAFT` → `IN_REVIEW`
- `POST /quotes/:id/return-to-draft`
- `POST /quotes/:id/send` — `IN_REVIEW` → `SENT`
- `POST /quotes/:id/accept` y `POST /quotes/:id/reject`
- `POST /services/:id/generate-visits`
- `POST /visits/:id/start` y `POST /visits/:id/complete`
- `POST /visits/:id/cancel` — calcula la política y acepta override
- `POST /visits/:id/claims`

El formulario público solo puede crear una solicitud para un slug de empresa existente. Rate limit en login y en ese formulario.

Los listados de agenda filtran por rango de fechas y devuelven visitas y evaluaciones con su ventana.

## 11. Persistencia

- PostgreSQL 16 en Docker para desarrollo.
- Prisma, un `schema.prisma` con secciones Core, Commercial, Cleaning y Billing.
- Identificadores `cuid()`.
- Importes de cotización en `Decimal`. La moneda sale de la empresa y se copia en la cotización.
- Porcentajes de cancelación en `Decimal`, leídos de `CancellationPolicyTier`.
- `clientInput` y `operationalScope` en `Json`, por separado.
- Índices por `companyId` más las claves de búsqueda habituales (cliente, propiedad, servicio, fecha de visita, estado).
- Restricciones únicas por empresa donde el negocio lo pide (folio, email de usuario a nivel global).

El schema de Prisma no se escribe en este paso. La parte operativa ya puede modelarse con las decisiones cerradas. Las tablas de billing e impuesto se dejan provisionales hasta Sylvia y el CPA.

## 12. Files / storage

`File` es el metadato. `StorageProvider` es la implementación.

Contrato del proveedor:

- `put` — guarda el binario y devuelve `storageKey`
- `open` — devuelve el contenido o una URL de lectura autorizada
- `delete` — borra el binario

`LocalStorage` escribe en disco durante el desarrollo. El `storageKey` es opaco para el dominio. `VisitPhoto`, un adjunto de checklist y un adjunto de incidente guardan `fileId` y su propio significado (`BEFORE`, `AFTER`, evidencia).

Más adelante se agrega un proveedor `OCI` o `S3` que cumple el mismo contrato. Las tablas de visitas, checklists e incidentes no cambian. Los archivos ya guardados conservan su `storageProvider`, así que un archivo local y uno de objeto pueden coexistir durante una migración.

La descarga pasa por la API, con autenticación, permiso y `companyId`. El navegador no recibe la ruta física.

## 13. Agenda

La agenda del MVP es una vista de `Visit` y `PropertyAssessment` por día y por persona. No hay una tabla genérica de eventos.

Cada cita muestra la ventana prometida (`windowStart`–`windowEnd`) y, cuando existen, el inicio y el fin reales.

Buffer operativo: setting `schedule.bufferMinutes`, cerrado en **45 minutos**. Es el hueco entre el `windowEnd` de una visita y el `windowStart` de la siguiente para el mismo trabajador.

En el MVP la agenda avisa si el hueco es menor que el buffer. No impide guardar. El dato queda listo para bloquear más adelante sin cambiar el modelo de `Visit`.

La ventana por defecto es de 120 minutos. Cada cita puede usar otra.

## 14. Cotizaciones

Ciclo de una `Quote`:

```text
DRAFT → IN_REVIEW → SENT → ACCEPTED
                  ↘ DRAFT     ↘ REJECTED
                              ↘ EXPIRED
```

- `DRAFT`: preparación. Líneas editables.
- `IN_REVIEW`: lista para que Sylvia la revise.
- `SENT`: el cliente ya la recibió. Solo desde `IN_REVIEW`, y solo si el usuario tiene `quotes.send`.
- Con evaluación pendiente, el envío espera `DONE` o una dispensa explícita `WAIVED`, auditada.
- `ACCEPTED`: crea o actualiza `Client` y crea el `Service`.

Preparar la cotización usa `operationalScope` como contexto de trabajo y las `QuoteLine` como resultado económico. `clientInput` permanece como lo que dijo el cliente. Variables del alcance operacional: áreas, sqft, condición, cocinas, electrodomésticos, horno doble, refrigerador, gabinetes, objetos, lámparas, ventiladores, ventanas accesibles, trabajo debajo de muebles y otros extras. Habitaciones, baños, mascotas y niños entran por la captura del cliente y el coordinador puede precisarlas después.

El MVP no calcula esas variables. Un motor de pricing, si algún día existe, leería el alcance y propondría líneas; una persona seguiría pudiendo editarlas antes de la revisión.

Aceptar una cotización recurrente crea el `Service` con frecuencia `WEEKLY`, `BIWEEKLY` o `MONTHLY`. La primera visita nace `INITIAL` y las siguientes `MAINTENANCE`, ambas editables. La generación de ese primer tramo es la misma acción manual de la sección 15.

## 15. Recurrencia

Frecuencias del MVP:

| Frecuencia | Efecto |
|---|---|
| `ONE_TIME` | Una visita |
| `WEEKLY` | Una visita cada 7 días |
| `BIWEEKLY` | Una visita cada 14 días |
| `MONTHLY` | Una visita cada mes, el mismo día de calendario cuando exista |

La generación copia fecha, ventana, duración estimada y política de fotos. El coordinador elige “generar hasta” una fecha. La interfaz propone 8 semanas como fecha inicial y acepta otra. No hay motor RRULE, ni cron, ni excepciones del tipo “el segundo martes” en este corte.

Una visita generada se puede mover, saltar (`SKIPPED`) o cancelar sin borrar el `Service`.

Regla de la primera visita y de la brecha, ya cerrada:

- La primera visita del `Service` nace `INITIAL`.
- Cada visita siguiente nace `MAINTENANCE`.
- Setting `recurrence.gapResetDays` = 45. El número vive en configuración.
- Si la última `Visit` `COMPLETED` de ese servicio es anterior al umbral, la visita nueva sigue en `MAINTENANCE` y recibe la sugerencia `INITIAL`.
- Aceptar o descartar la sugerencia es una acción del coordinador. Aceptarla queda auditada.
- Cualquier visita puede cambiar de kind a mano, con auditoría.

Pausar el servicio impide generar visitas nuevas. Las ya creadas siguen en agenda hasta que alguien las cancele o las complete.

## 16. Billing y pagos

**Esta sección no está aprobada.** El porcentaje de cancelación sí lo está (sección 8); el cobro no. Sylvia confirma primero el flujo de dinero. El CPA confirma después el sales tax. Hasta esas dos conversaciones no se cierra el modelo de cargos, pagos ni impuesto, y no se escribe el schema de billing.

Lo único fijo hoy:

- La moneda de la empresa es USD.
- Al cancelar una visita se calcula y se guarda el porcentaje según la política.
- Un reclamo y una revisita `CORRECTION` existen como operación, aparte del dinero.
- No hay pasarela de pagos en el MVP.
- No se calcula sales tax en el MVP.

Queda abierto, a propósito:

- Si hay depósito al aceptar la cotización y un saldo después del servicio.
- Si el saldo espera unas 24 horas tras completar la visita.
- Si un reclamo abierto retiene ese saldo.
- Si la revisita se cobra, se incluye o no genera cargo.
- En qué momento el porcentaje de cancelación se vuelve un monto exigible, y sobre qué base.
- Qué medios de pago se registran.
- Si el servicio está gravado en Florida, con qué tasa y sobre qué base.

Un esbozo posible (`Charge` con depósito, saldo, cargo por cancelación y ajuste; `Payment` manual; estado `HELD`) es solo una reserva conceptual. No es una decisión. Los gastos operativos (`Expense`) tampoco se diseñan hasta que el cobro al cliente esté definido.

## 17. Portal futuro

El portal del cliente no se construye ahora. El modelo ya no lo bloquea:

- El rol `CLIENT` existe en el catálogo.
- Una membresía futura puede apuntar a un `Contact` del `Client`.
- El cliente verá sus solicitudes, cotizaciones, ventanas de visita y fotos que el equipo marque como visibles.
- Reclamos dentro de la ventana de 24 horas pueden nacer en el portal; mientras tanto los registra el equipo.

Tampoco se construye la app de campo del trabajador. En el MVP `Worker` no tiene `User`. La ejecución se registra en la aplicación interna. El enlace `Worker.userId` queda para más adelante y no cambia la visita.

Notificaciones in-app sí entran en el core, como filas. Correo y WhatsApp son canales posteriores que consumen el mismo registro.

## 18. Seguridad

- Contraseñas con bcrypt. El JWT no lleva permisos embebidos de forma definitiva: `requireAuth` los carga de la membresía activa.
- Helmet, CORS restringido al origen del frontend, límite de tamaño del JSON.
- Rate limit en login y en la solicitud pública.
- Toda consulta de negocio incluye `companyId` del token.
- El alta pública solo escribe una solicitud del tenant indicado por el slug. No lee otros datos.
- Descargar un archivo exige sesión, permiso y pertenencia a la empresa. El proveedor de storage no se expone como directorio público.
- Overrides (cancelación, dispensa de evaluación, cambio de kind) exigen permiso y quedan en auditoría.
- Secretos en variables de entorno. No entran al repositorio.
- Usuarios y membresías inactivos quedan fuera en el mismo middleware.

## 19. Auditoría

`AuditLog` guarda acciones de configuración y excepciones de negocio.

Campos: `companyId`, actor, acción, tipo de entidad, id de entidad, descripción, metadatos, fecha.

Se audita como mínimo:

- Alta, activación y desactivación de usuarios
- Cambios de settings, incluida la política de cancelación
- Cambios de estado de cotización, en especial el envío
- Dispensa de una evaluación
- Aceptación de cotización y alta del `Service`
- Cancelación de visita, con horas hasta `windowStart`, porcentaje calculado y porcentaje aplicado si hubo excepción
- Aceptar o descartar la sugerencia de pasar una visita a `INITIAL`
- Cambio manual de kind (`INITIAL` / `MAINTENANCE` / `CORRECTION`)
- Apertura y cierre de reclamos

La actividad comercial cotidiana (notas de un lead) puede vivir en su propio historial. La auditoría de plataforma no depende de un lead, a diferencia del modelo de CRM_Base.

## 20. Estrategia de reutilización de CRM_Base

CRM_Base no se modifica, no se submodulariza y no es dependencia de Azul Cerezo. Cada proyecto tiene su `package.json`, su base y sus contenedores.

Cuando se cree el esqueleto, se copian y adaptan solo piezas de infraestructura. Después divergen.

### Sí se reutiliza como patrón

- Workspaces npm, scripts de desarrollo y Docker Compose de PostgreSQL
- Arranque de Express: Helmet, CORS, JSON, log de requests, 404 y manejador de errores
- `AppError` y envoltorio async
- Login con bcrypt, firma y verificación JWT, rate limit de login
- Forma del middleware de autenticación, reescrita para membresía y permisos
- Forma del servicio de auditoría, con `companyId` y entidad
- CRUD de usuarios y perfil como referencia
- Frontend: cliente HTTP, almacenamiento del token, contexto de auth, ruta protegida, layout de sidebar y topbar
- UI genérica: botón, input, card, toast, campo de contraseña, badge de estado

### No se reutiliza

- `Lead` como centro del sistema, referidos, motivos de no inversión, razones de seguimiento financiero
- Estados y orígenes de ese pipeline
- `ServiceCategory` de inversiones, charlas y contabilidad
- Actividades colgadas de un lead
- Servicios, páginas, dashboard y reportes de ese pipeline
- Landing, contenidos y logo de VR Consultorías
- Roles `ADMIN | USER` como modelo de autorización
- Seed, nombres de contenedor y textos de CRM Referidos

## 21. Qué queda explícitamente fuera del MVP

- Portal del cliente y app móvil de trabajadores
- WhatsApp, correo transaccional y otras integraciones
- Pasarela de pagos
- Factura fiscal y cálculo de sales tax, pendientes de Sylvia y del CPA
- Reglas cerradas de depósito, saldo, retención por reclamo y cobro de la revisita
- Motor automático de pricing
- Motor de recurrencia avanzado (RRULE, festivos, “el segundo martes”)
- Bloqueo automático del buffer en la agenda
- Cron que genere visitas solo
- Almacenamiento productivo en OCI u S3 (sí queda la interfaz; el proveedor real es posterior)
- Análisis de fotografías con IA
- Pantalla para diseñar roles y permisos
- Consola multi-empresa de GYPSA
- Paquete npm `@gypsa/core`
- Campos dinámicos, workflows genéricos y constructor de reportes
- Internacionalización más allá del español
- Tokens de refresco y SSO
- Cualquier cambio en CRM_Base

## 22. Fases de implementación

Cada fase termina con algo usable. No se adelantan módulos de fases posteriores “por si acaso”.

| Fase | Entrega |
|---|---|
| 0 | Decisiones operativas 1–10 cerradas en este documento. Billing y sales tax siguen abiertos. Sin schema de Prisma |
| 1 | Monorepo, Docker, Prisma, login, empresa, membresías, roles, auditoría, shell. Seed de Azul Cerezo: US, Florida, USD, `America/New_York`, español, sin ciudad fija. Política de cancelación, buffer de 45 minutos, ventana de 120 minutos, duraciones de referencia, fotos por kind y `gapResetDays` = 45 |
| 2 | Clientes, contactos, direcciones genéricas y propiedades |
| 3 | Leads, solicitudes con `clientInput` y `operationalScope`, evaluación de propiedad, cotizaciones en `DRAFT` / `IN_REVIEW` / `SENT`, líneas manuales |
| 4 | Aceptación que crea `Service` y visitas. Primera visita `INITIAL`, siguientes `MAINTENANCE`, sugerencia tras 45 días. Generación manual hasta una fecha, con 8 semanas como propuesta. Agenda y aviso de buffer |
| 5 | Trabajadores sin cuenta, equipos, asignación, ejecución, checklists por kind, fotos vía `File` |
| 6 | Cancelación con política y excepción, dejando el porcentaje registrado. Reclamos y revisitas. El cobro espera las reglas de billing |
| 7 | Reportes básicos y notificaciones in-app |
| Después | Portal, canales, pasarela, storage de objetos, IA de fotos, segunda empresa. Billing e impuesto cuando Sylvia y el CPA los cierren |

## 23. Riesgos y decisiones pendientes

### Riesgos

- **Fuga entre empresas.** Una consulta sin `companyId` mezcla tenants. El argumento es obligatorio y visible.
- **Volver a centrar todo en el lead.** Visitas, fotos y pagos cuelgan del `Service` y la `Visit`. El lead termina al ganar el cliente.
- **Convertir las referencias de Sylvia en validaciones rígidas.** Duración y fotos son defaults copiados a la visita, editables, y no entran al precio.
- **Política de cancelación duplicada en código.** Cualquier cargo lee las tiers de la empresa.
- **Agenda optimista.** El buffer solo avisa. Dos visitas pueden quedar pegadas hasta que se active el bloqueo.
- **Reclamos y cobro.** El reclamo y la revisita ya tienen lugar en el modelo operativo. El efecto sobre el dinero no se inventa antes de hablar con Sylvia y con el CPA.
- **Fotos.** El volumen crece. El contrato de storage tiene que existir en la fase 5, aunque el disco local baste en desarrollo.
- **Copiar dominio de CRM_Base.** Solo se copian los archivos listados en la sección 20.
- **Extraer plataforma demasiado pronto.** `@gypsa/core` espera al segundo producto.

### Decisiones ya cerradas

- Monolito modular, JavaScript, React + Vite + Tailwind, Express, Prisma, PostgreSQL, JWT.
- Multi-tenant por `companyId`.
- Primer tenant: USA, Florida, USD, `America/New_York`, interfaz en español. Sin ciudad fija en la configuración.
- `Address` genérica: la ciudad es un dato de cada dirección.
- `Lead`, `Client`, `QuoteRequest` y `Quote` separados. Un cliente pide otra cotización sin volverse lead.
- `clientInput` es lo que envía el cliente. `operationalScope` y las `QuoteLine` los completa el coordinador. El segundo bloque no borra el primero.
- La cotización nace en `DRAFT`, pasa por `IN_REVIEW` y solo llega a `SENT` con el permiso `quotes.send`.
- `PropertyAssessment` es una entidad distinta de `Visit`.
- Con evaluación pendiente no se envía la cotización, salvo dispensa explícita y auditada.
- Cancelación por empresa, con tiers en datos, apagable, y con excepción por visita.
- Reloj de cancelación: horas hasta `windowStart`.
- Bordes: `h > 72` → 0 %; `24 < h <= 72` → 40 % (exactamente 72 h = 40 %); `h <= 24` → 100 % (exactamente 24 h = 100 %).
- La visita tiene fecha, ventana prometida de 120 minutos por defecto (editable) e inicio/fin reales.
- Buffer de 45 minutos: la agenda avisa y no bloquea.
- Kinds `INITIAL`, `MAINTENANCE` y `CORRECTION`.
- En un servicio recurrente, la primera visita nace `INITIAL` y las siguientes `MAINTENANCE`. Ambas se pueden editar.
- Recurrencia weekly, biweekly y monthly. Generación manual hasta una fecha; la interfaz propone 8 semanas. Sin cron.
- Tras 45 días sin visita `COMPLETED`, el sistema sugiere `INITIAL` y no lo aplica solo.
- `File` desacoplado del disco, con proveedor intercambiable.
- El agregado que genera visitas se llama `Service`. `ServiceOrder` no forma parte del modelo.
- Pricing manual con `Quote` + `QuoteLine`.
- `Worker` separado de `User`. En el MVP los trabajadores no tienen cuenta.
- CRM_Base permanece separado y no es dependencia de runtime.

### Pendiente explícito: billing, pagos y sales tax

Estas decisiones no están cerradas. No deben convertirse en tablas ni en reglas de negocio hasta confirmarlas. El orden es Sylvia primero y el CPA después.

**Con Sylvia**

- Si al aceptar hay un depósito y después un saldo, o un solo cobro.
- Si el saldo espera la ventana de unos 24 horas después de completar la visita.
- Si un reclamo abierto retiene ese saldo hasta resolverlo.
- Si la revisita `CORRECTION` se cobra.
- Sobre qué monto se aplica el porcentaje de cancelación ya aprobado, y cuándo pasa a ser exigible.
- Qué medios de pago se van a registrar.

**Con el CPA, después**

- Si la limpieza residencial en Florida está gravada con sales tax.
- Tasa, base imponible y si el impuesto es una línea distinta del precio.
- Qué comprobante se le entrega al cliente, si hace falta alguno distinto de un recibo interno.

Mientras sigan abiertas, el MVP no calcula impuesto, no define depósito ni saldo, y no fija el momento del cobro. El porcentaje de cancelación sí se calcula y se guarda.
