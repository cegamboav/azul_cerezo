# AZUL CEREZO — Modelo conceptual de dominio

Estado: para revisión, anterior al diseño físico.  
Fuente: `docs/ARCHITECTURE_PLAN.md`, con las decisiones operativas ya aprobadas.

Este documento nombra entidades, relaciones y reglas. No es un schema de Prisma, no define tipos de PostgreSQL y no trae migraciones ni código.

Billing, pagos y sales tax siguen abiertos. Aquí `Invoice`, `InvoiceLine` y `Payment` existen solo como conceptos a revisar. Sus reglas de depósito, saldo, reclamo, revisita e impuesto no se cierran en este documento.

## Cómo leer cada entidad

1. Propósito.
2. Relaciones.
3. Cardinalidad.
4. Estados principales, cuando tiene ciclo.
5. Información que le pertenece.
6. Información que deliberadamente no le pertenece.
7. Reglas de negocio relevantes.
8. Dependencia de `companyId`.
9. Decisiones todavía abiertas.

`companyId` es el identificador de `Company`. Salvo que una entidad diga lo contrario, toda fila de negocio lo lleva y se consulta siempre con ese filtro.

## Mapa

```text
Company
  ├─ Membership ── User
  ├─ Role ── RolePermission ── Permission (catálogo en código)
  ├─ Client ── Contact
  │            └─ Property ── Address
  ├─ Lead
  ├─ QuoteRequest ── PropertyAssessment
  │        └─ Quote ── QuoteLine
  ├─ ServiceOffering
  ├─ Service ── Visit ── Assignment ── Worker
  │                 ├─ ChecklistRun
  │                 ├─ VisitPhoto ── File
  │                 ├─ Incident ── File
  │                 └─ Claim ── Visit (revisita, kind CORRECTION)
  └─ Invoice ── InvoiceLine
             └─ Payment
     Expense
```

La recurrencia no tiene entidad propia. Vive en `Service` y se materializa en `Visit`.

## Reglas transversales ya cerradas

- Una `QuoteRequest` pertenece a un `Lead`, a un `Client`, o a los dos después de convertir el prospecto. Nunca a ninguno.
- Una solicitud de un cliente existente no crea un `Lead`.
- `PropertyAssessment` no es una `Visit`.
- `Service` es lo contratado para un cliente y una propiedad. `Visit` es una ejecución.
- `Worker` no es un `User`. En el MVP el trabajador no tiene cuenta.
- `File` guarda el metadato del archivo. `VisitPhoto`, el checklist y el incidente no guardan una ruta física.
- La dirección es genérica. La empresa no fija una ciudad.
- El porcentaje de cancelación se calcula con las horas que faltan hasta `windowStart` y se guarda en la visita. Ese porcentaje todavía no define un cobro.
- Tras 45 días sin una visita completada, el sistema sugiere `INITIAL`. La visita siguiente nace `MAINTENANCE` hasta que alguien acepte la sugerencia.

---

## Company

1. **Propósito.** Es el tenant. Azul Cerezo es la primera fila, creada por seed, no un caso especial del código.
2. **Relaciones.** Raíz de membresías, roles, clientes, leads, solicitudes, servicios, trabajadores, archivos, settings y la política de cancelación.
3. **Cardinalidad.** Una empresa tiene muchas filas de negocio. Una fila de negocio pertenece a una empresa.
4. **Estados.** `ACTIVE`. Suspender una empresa queda fuera de este corte.
5. **Información.** Nombre legal, nombre comercial, slug, teléfono, correo, país, estado o región, moneda, zona horaria, idioma de la interfaz, color. En el seed de Azul Cerezo: USA, Florida, USD, `America/New_York`, español, slug `azul-cerezo`.
6. **No le pertenece.** Ciudad de operación. Direcciones de clientes o propiedades. Precios. Porcentajes de cancelación (viven en `CancellationPolicy`). Permisos. Datos de un usuario.
7. **Reglas.** El slug identifica el formulario público. País y estado describen dónde opera y pueden preseleccionarse en ese formulario. La ciudad de cada dirección la aporta quien la escribe. No hay rama de código por nombre de empresa.
8. **companyId.** No. `Company` es el propio tenant. Las demás entidades apuntan a su id.
9. **Abiertas.** Ninguna de identidad. El cobro y el impuesto de esta empresa siguen abiertos en la sección de billing.

## User

1. **Propósito.** Identidad de una persona que inicia sesión: nombre, correo y credencial.
2. **Relaciones.** Un usuario tiene muchas `Membership`. Más adelante, un `Worker` puede apuntar a un usuario. `File.uploadedBy` y la auditoría apuntan a un usuario.
3. **Cardinalidad.** Usuario 1 — * membresías. En el MVP hay una sola empresa, así que cada usuario tiene una membresía.
4. **Estados.** Activo o inactivo. Inactivo no entra.
5. **Información.** Nombre, email, teléfono opcional, hash de contraseña, activo, fechas.
6. **No le pertenece.** El rol. La empresa activa. El perfil operativo de un trabajador. Permisos sueltos. Preferencias de una empresa.
7. **Reglas.** El email es único en toda la plataforma. La autorización sale de la membresía de la empresa activa, no de un rol colgado del usuario. El MVP no crea usuarios para trabajadores.
8. **companyId.** No. La identidad es global. El aislamiento entra por `Membership`.
9. **Abiertas.** Ninguna para el MVP. Tokens de refresco, SSO y varias empresas por usuario quedan para después, sin cambiar esta entidad.

## Membership

1. **Propósito.** Une a una persona con una empresa y le da un rol dentro de ella.
2. **Relaciones.** * — 1 `User`, * — 1 `Company`, * — 1 `Role`.
3. **Cardinalidad.** Un usuario puede tener una membresía por empresa. Una empresa tiene muchas membresías. Cada membresía tiene un rol.
4. **Estados.** Activa o inactiva. Una membresía inactiva no autoriza, aunque el usuario siga activo.
5. **Información.** Usuario, empresa, rol, activa, fechas.
6. **No le pertenece.** La contraseña. El catálogo de permisos. Los datos del trabajador de campo. Un permiso concedido solo a esta persona, fuera del rol.
7. **Reglas.** La sesión usa la membresía de la empresa del token. Hace falta usuario activo y membresía activa. El rol `WORKER` existe en el catálogo y en el MVP no se asigna. El rol `CLIENT` queda reservado al portal.
8. **companyId.** Sí.
9. **Abiertas.** Ninguna para el MVP. Varias membresías por usuario se soportan en el modelo y no se usan todavía.

## Role

1. **Propósito.** Paquete de permisos con nombre, dentro de una empresa.
2. **Relaciones.** * — 1 `Company`. 1 — * `RolePermission`. 1 — * `Membership`.
3. **Cardinalidad.** Una empresa tiene varios roles. Un rol tiene muchos permisos. Muchas membresías pueden compartir un rol.
4. **Estados.** No tiene ciclo. Se siembra y se usa.
5. **Información.** Empresa, clave (`OWNER`, `ADMIN`, `COORDINATOR`, `WORKER`, `CLIENT`), nombre visible.
6. **No le pertenece.** La lista maestra de permisos. Usuarios. Reglas de limpieza.
7. **Reglas.** Los cinco roles se siembran por empresa. El MVP no ofrece pantalla para inventar roles. `OWNER` y `ADMIN` reciben `quotes.send` en el seed. `COORDINATOR` prepara y manda a revisión, y no envía al cliente. Esas asignaciones son datos del rol, no una excepción por nombre de persona.
8. **companyId.** Sí.
9. **Abiertas.** El ajuste fino de qué permiso lleva cada rol, dentro del catálogo, puede afinarse al implementar. El modelo no cambia por eso.

## Permission

1. **Propósito.** Nombrar una acción que el sistema puede autorizar, por ejemplo `quotes.send`.
2. **Relaciones.** El catálogo vive en código. `RolePermission` une un `Role` con una clave de permiso.
3. **Cardinalidad.** Un rol tiene muchos permisos. Una misma clave puede estar en varios roles. Un permiso no se asigna directo a un usuario.
4. **Estados.** No tiene.
5. **Información.** Clave estable y una descripción para quien mantiene el catálogo. `RolePermission` guarda solo rol y clave.
6. **No le pertenece.** Alta de permisos por pantalla. Permisos distintos por empresa. Condiciones de negocio (la evaluación pendiente no es un permiso; es una regla de la cotización).
7. **Reglas.** Enviar una cotización exige `quotes.send`, además del estado `IN_REVIEW` y de la regla de evaluación. El permiso se resuelve desde la membresía activa en cada petición.
8. **companyId.** El catálogo no. `RolePermission` queda acotado por la empresa del rol.
9. **Abiertas.** La lista exacta de claves puede crecer al implementar módulos. No se abre un permiso editable por el usuario.

Catálogo previsto, todavía afinable: `clients.read`, `clients.write`, `quotes.read`, `quotes.write`, `quotes.review`, `quotes.send`, `visits.read`, `visits.assign`, `visits.execute`, `visits.cancel`, `billing.read`, `billing.write`, `users.manage`, `settings.manage`.

## Client

1. **Propósito.** Cliente ya establecido. Es quien contrata y a quien se le limpia.
2. **Relaciones.** 1 — * `Contact`. 1 — * `Property`. 1 — * `QuoteRequest`. 1 — * `Service`. Origen opcional en el `Lead` que lo originó.
3. **Cardinalidad.** Una empresa tiene muchos clientes. Un cliente tiene al menos un contacto cuando se crea por conversión. Puede tener varias propiedades y varios servicios.
4. **Estados.** `ACTIVE` e `INACTIVE`. Inactivo no recibe servicios nuevos. Su historia se conserva.
5. **Información.** Nombre para mostrar, notas internas, activo, y el lead de origen si nació de un prospecto.
6. **No le pertenece.** El pipeline del prospecto. Las líneas de precio. La frecuencia de limpieza. La ventana de una visita. Ser tratado otra vez como lead cuando pide una cotización nueva.
7. **Reglas.** Se crea al aceptar la cotización de un lead, o cuando el equipo lo da de alta. A partir de ahí, sus solicitudes llevan `clientId` y `leadId` vacío. No se “convierte de nuevo” en lead.
8. **companyId.** Sí. El mismo correo puede existir en otra empresa como otro cliente.
9. **Abiertas.** Si hará falta una dirección de facturación distinta de la propiedad. Eso espera a billing.

## Contact

1. **Propósito.** Persona de contacto de un cliente: a quién se llama o se escribe.
2. **Relaciones.** * — 1 `Client`.
3. **Cardinalidad.** Un cliente tiene uno o varios contactos. Un contacto pertenece a un solo cliente.
4. **Estados.** No tiene ciclo comercial. Puede marcarse como contacto principal.
5. **Información.** Nombre, teléfono, correo, si es el principal, notas.
6. **No le pertenece.** Credenciales. Rol de la plataforma. La dirección de la casa, que es de `Property` y `Address`. El estado del lead.
7. **Reglas.** Al convertir un lead se crea el contacto principal con el nombre, teléfono y correo del prospecto. El portal futuro podrá enlazar un contacto con un `User`; el MVP no lo hace.
8. **companyId.** Sí, además del cliente.
9. **Abiertas.** Ninguna para el MVP.

## Property

1. **Propósito.** El lugar que se limpia para un cliente: una casa, un apartamento u otra sede.
2. **Relaciones.** * — 1 `Client`. 1 — 1 `Address`. 1 — * `Service`. Una `QuoteRequest` puede apuntar a una propiedad cuando el cliente ya existe.
3. **Cardinalidad.** Un cliente tiene varias propiedades. Cada propiedad tiene una dirección principal. Varios servicios pueden ocurrir en la misma propiedad a lo largo del tiempo; lo normal es uno activo.
4. **Estados.** `ACTIVE` e `INACTIVE`.
5. **Información.** Cliente, dirección, nombre corto (“casa”, “apto 4B”), notas de acceso, y la ficha mantenida del lugar cuando ya se conoce: habitaciones, baños, cocinas, pies cuadrados y otros rasgos estables.
6. **No le pertenece.** El snapshot de una solicitud. El precio. La agenda. Los datos de un prospecto que todavía no es cliente. Una ciudad obligatoria distinta de la que venga en su dirección.
7. **Reglas.** No existe propiedad sin cliente. Por eso una solicitud de prospecto guarda la dirección dentro de `clientInput` y solo crea `Property` al convertirse en cliente, o antes si el equipo ya dio de alta al cliente. Actualizar la ficha de la propiedad no reescribe solicitudes ni cotizaciones ya hechas.
8. **companyId.** Sí.
9. **Abiertas.** Qué rasgos de `operationalScope` se copian a la ficha la primera vez. El modelo solo exige que la ficha y el snapshot sean independientes.

## Address

1. **Propósito.** Dirección postal genérica de una propiedad.
2. **Relaciones.** 1 — 1 `Property` en este corte. El texto que escribió el solicitante no es esta entidad: es una copia dentro de `QuoteRequest.clientInput`.
3. **Cardinalidad.** Cada propiedad tiene una dirección. Una dirección no se comparte entre propiedades en el MVP.
4. **Estados.** No tiene.
5. **Información.** `line1`, `line2` opcional, `city`, `stateRegion`, `postalCode`, `country`.
6. **No le pertenece.** Habitaciones, mascotas, precio, zona horaria de la empresa, ni una ciudad por defecto de Azul Cerezo.
7. **Reglas.** Todos los campos de lugar son datos de esa dirección. El formulario puede preseleccionar país y estado desde la empresa (US, FL) y deja la ciudad vacía. Guardar la solicitud no obliga a crear `Address` si todavía no hay propiedad.
8. **companyId.** Sí.
9. **Abiertas.** Dirección de facturación del cliente, cuando exista billing. Una propiedad con varias direcciones no entra en el MVP.

## Lead

1. **Propósito.** Prospecto interesado que todavía no es cliente.
2. **Relaciones.** 1 — * `QuoteRequest`. Al ganar, 0..1 `Client` de origen.
3. **Cardinalidad.** Una empresa tiene muchos leads. Un lead puede tener varias solicitudes. Un lead origina como máximo un cliente.
4. **Estados.** `NEW`, `CONTACTED`, `QUOTED`, `WON`, `LOST`.
5. **Información.** Nombre, teléfono, correo, origen del contacto (formulario, captura interna, u otro canal futuro), notas, estado.
6. **No le pertenece.** Propiedades, servicios, visitas, fotos, pagos, líneas de cotización, referidos, motivos de inversión ni el resto del dominio de VR Consultorías. Tampoco la solicitud de un cliente que ya existe.
7. **Reglas.** Se crea solo para quien todavía no es cliente. `WON` ocurre al aceptar una cotización suya y crear el `Client`. `LOST` cierra el prospecto sin crear cliente. Un cliente posterior no reabre ni recrea ese lead para pedir otra cotización.
8. **companyId.** Sí.
9. **Abiertas.** Si el teléfono del lead es único dentro de la empresa. Sirve para no duplicar prospectos y no está cerrado.

## QuoteRequest

1. **Propósito.** Una solicitud concreta de cotización. Es el pedido de “quiero un precio para este lugar”, no la propuesta económica y no la persona.
2. **Relaciones.** * — 0..1 `Lead`. * — 0..1 `Client`. * — 0..1 `Property`. 1 — * `Quote`. 0..1 — `PropertyAssessment`.
3. **Cardinalidad.** Muchas solicitudes por lead. Muchas solicitudes por cliente. Varias cotizaciones por solicitud. Como máximo una evaluación vigente por solicitud. La propiedad es opcional hasta que el lugar ya es una `Property`.
4. **Estados.** `RECEIVED`, `WAITING_ASSESSMENT`, `READY_TO_QUOTE`, `QUOTED`, `CLOSED`, `CANCELLED`.
5. **Información.**
   - A quién pertenece: `leadId`, `clientId`, `propertyId` cuando ya aplica.
   - `requiresAssessment`.
   - `clientInput`: snapshot inmutable de lo que envió el cliente (nombre, teléfono, correo, dirección genérica, mensaje, habitaciones, baños, mascotas, niños, frecuencia deseada si la indicó).
   - `operationalScope`: lo que completa después el coordinador (pies cuadrados, condición, áreas, cocinas, electrodomésticos, horno doble, refrigerador, gabinetes, objetos, lámparas, ventiladores, ventanas accesibles, trabajo debajo de muebles, extras, notas comerciales).
   - Canal de entrada: formulario público o captura interna.
6. **No le pertenece.** Las líneas de precio. El envío al cliente. La visita de limpieza. El porcentaje de cancelación. Convertir al cliente existente en lead. Borrar `clientInput` cuando el coordinador completa el otro bloque.
7. **Reglas.**
   - Siempre hay lead, cliente, o ambos. Nunca ninguno.
   - Prospecto: nace con `leadId` y sin `clientId`. No se asume que toda solicitud viene de un lead.
   - Cliente existente: nace con `clientId` y sin `leadId`. Si ya se conoce la casa, lleva `propertyId`.
   - Al ganar el prospecto, la misma solicitud recibe `clientId` y conserva el `leadId` como origen.
   - `requiresAssessment` lo puede marcar el coordinador mientras ninguna cotización de esa solicitud esté `SENT`.
   - Si exige evaluación, no se envía ninguna de sus cotizaciones hasta que la evaluación esté `DONE` o `WAIVED`.
8. **companyId.** Sí.
9. **Abiertas.** Qué ocurre con las otras cotizaciones de la misma solicitud cuando una se acepta. El modelo permite varias; la regla de cierre entre ellas no está fijada.

## PropertyAssessment

1. **Propósito.** Visita de evaluación previa a cotizar, cuando la solicitud la necesita.
2. **Relaciones.** * — 1 `QuoteRequest`. Responsable operativo opcional: un `Worker`. Quien la agenda es un `User`.
3. **Cardinalidad.** Una solicitud tiene cero evaluaciones si no la requiere, o una evaluación que se reprograma sobre el mismo registro. No pertenece a un `Service`.
4. **Estados.** `SCHEDULED`, `DONE`, `CANCELLED`, `WAIVED`.
5. **Información.** Solicitud, fecha, `windowStart`, `windowEnd`, trabajador asignado, notas, quién dispensó y por qué si el estado es `WAIVED`.
6. **No le pertenece.** Checklist de limpieza, fotos de ejecución, `visitKind`, cobro, cancelación con la política del 72/24, ni el inicio y fin reales de una limpieza. Puede mostrarse en la agenda y aun así no es una `Visit`.
7. **Reglas.** `WAIVED` es una dispensa explícita: permiso, motivo y auditoría. `DONE` o `WAIVED` desbloquean el envío. `CANCELLED` no lo desbloquea. La ventana por defecto es de 120 minutos y se puede editar. El buffer de 45 minutos también avisa aquí, sin bloquear.
8. **companyId.** Sí.
9. **Abiertas.** Si la evaluación puede repetirse como un segundo registro cuando la primera quedó `DONE` y el equipo quiere volver a ver la casa. El MVP contempla una evaluación por solicitud.

## Quote

1. **Propósito.** Propuesta económica preparada a partir de una solicitud. Sylvia, o quien tenga permiso, la revisa antes de enviarla.
2. **Relaciones.** * — 1 `QuoteRequest`. 1 — * `QuoteLine`. Al aceptarse, 0..1 `Service`.
3. **Cardinalidad.** Una solicitud tiene muchas cotizaciones. Una cotización tiene muchas líneas. Una cotización aceptada origina un servicio.
4. **Estados.** `DRAFT`, `IN_REVIEW`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`.
5. **Información.** Solicitud, moneda copiada de la empresa (USD), vigencia, notas internas, estado, quién la envió y cuándo.
6. **No le pertenece.** El texto crudo del cliente. La ficha operativa completa, que sigue en la solicitud. El cálculo automático desde pies cuadrados. La política de cancelación. El impuesto. El depósito.
7. **Reglas.**
   - Crear la cotización la deja en `DRAFT`. Nada la pasa solo a `SENT`.
   - `DRAFT` → `IN_REVIEW` → `SENT`. De revisión puede volver a borrador.
   - `SENT` solo con el permiso `quotes.send`, y solo desde `IN_REVIEW`.
   - Si la solicitud exige evaluación y no está `DONE` ni `WAIVED`, el envío no procede.
   - `ACCEPTED` crea o reutiliza `Client`, `Contact` y `Property` si faltaban, marca el lead como `WON` cuando había lead, y crea el `Service`.
   - Las líneas las escribe una persona. El alcance no las calcula.
8. **companyId.** Sí.
9. **Abiertas.** El destino de las cotizaciones hermanas cuando una se acepta. La vigencia por defecto en días. Si una cotización `SENT` se puede retirar sin contarla como rechazo.

## QuoteLine

1. **Propósito.** Una línea de la propuesta: qué se cobra, en qué cantidad y a qué precio.
2. **Relaciones.** * — 1 `Quote`.
3. **Cardinalidad.** Una cotización tiene una o varias líneas. Una línea pertenece a una sola cotización.
4. **Estados.** No tiene. Sigue el borrador de su cotización: se edita en `DRAFT` y deja de editarse al enviarla.
5. **Información.** Descripción, cantidad, unidad, precio unitario, importe, orden y un tipo libre de línea (área, extra, mano de obra u otro). Moneda heredada de la cotización.
6. **No le pertenece.** Pies cuadrados, mascotas, gabinetes y el resto del alcance. Esos datos explican la línea y viven en la solicitud. Tampoco el impuesto, el depósito ni la visita.
7. **Reglas.** El importe lo decide quien cotiza. No hay motor de tarifas. Borrar o cambiar líneas después de `SENT` no forma parte del flujo: una alternativa es otra `Quote`.
8. **companyId.** Sí, por la cotización y de forma propia para filtrar sin ambigüedad.
9. **Abiertas.** Si el importe se guarda además de cantidad por precio, para tolerar un redondeo manual. Es un detalle físico, no una regla de negocio nueva.

## ServiceOffering

1. **Propósito.** Lo que la empresa ofrece en su catálogo: “limpieza inicial”, “mantenimiento”, u otro nombre comercial.
2. **Relaciones.** 1 — * `Service`, de forma opcional. Un servicio contratado puede citar el offering del que salió.
3. **Cardinalidad.** Una empresa tiene varios offerings. Muchos servicios pueden apuntar al mismo. Un servicio puede no apuntar a ninguno.
4. **Estados.** Activo o inactivo. Inactivo no se ofrece en altas nuevas y no borra servicios ya contratados.
5. **Información.** Nombre, descripción, activo.
6. **No le pertenece.** El precio. La frecuencia de un cliente. Las visitas. Los porcentajes de cancelación. La duración obligatoria.
7. **Reglas.** Es catálogo de la empresa, no el contrato. No sustituye a `visitKind`. Dos clientes con el mismo offering tienen dos `Service` distintos.
8. **companyId.** Sí. El nombre es único dentro de la empresa.
9. **Abiertas.** Ninguna que bloquee el modelo. El catálogo inicial de Azul Cerezo se siembra cuando se implemente.

## Service

1. **Propósito.** El servicio contratado y configurado para un cliente en una propiedad. Un semanal de una casa es un `Service` que genera muchas visitas.
2. **Relaciones.** * — 1 `Client`. * — 1 `Property`. * — 0..1 `ServiceOffering`. * — 0..1 `Quote` de origen. 1 — * `Visit`.
3. **Cardinalidad.** Un cliente tiene varios servicios, normalmente en propiedades distintas o en épocas distintas. Un servicio tiene muchas visitas. Una visita pertenece a un solo servicio.
4. **Estados.** `ACTIVE`, `PAUSED`, `ENDED`.
5. **Información.** Cliente, propiedad, offering opcional, cotización de origen, frecuencia (`ONE_TIME`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`), fecha de inicio, fecha de fin si terminó, notas.
6. **No le pertenece.** La ventana de un día concreto. El checklist ejecutado. Las fotos. El trabajador de una fecha. El precio de la cotización. Una entidad `RecurringPlan` aparte. El porcentaje ya cobrado.
7. **Reglas.**
   - Nace al aceptar la cotización, ya con cliente y propiedad.
   - `ONE_TIME` produce una visita.
   - `WEEKLY` cada 7 días, `BIWEEKLY` cada 14, `MONTHLY` el mismo día de mes cuando exista.
   - En un recurrente, la primera visita nace `INITIAL` y las siguientes `MAINTENANCE`. Ambas se pueden editar en la visita.
   - Las visitas las genera una persona hasta una fecha. La interfaz propone 8 semanas. No hay cron.
   - `PAUSED` no genera visitas nuevas. Las ya creadas siguen hasta completarlas, saltarlas o cancelarlas.
   - `ENDED` deja de generar. Cada visita futura ya creada se cancela por separado, con su propio cálculo.
8. **companyId.** Sí.
9. **Abiertas.** Si el equipo puede crear un `Service` a mano, sin cotización aceptada. El camino aprobado es la aceptación.

## RecurringPlan

No es una entidad.

1. **Propósito.** Iba a ser la regla que fabrica visitas. Esa regla cabe en `Service` y separarla añade un concepto sin un segundo caso de uso.
2. **Relaciones.** Ninguna.
3. **Cardinalidad.** No aplica. La frecuencia y la fecha de inicio están en `Service`. Las ocurrencias son `Visit`.
4. **Estados.** No aplica.
5. **Información.** La que parecería suya —frecuencia, ancla, horizonte— pertenece a `Service`. El horizonte de 8 semanas es el valor que propone la pantalla al generar, no un registro.
6. **No le pertenece.** Nada, porque no existe. En particular no debe convertirse en un motor de excepciones, festivos o “el segundo martes”.
7. **Reglas.** Generar visitas es una acción sobre `Service`, no la creación de otro agregado. La sugerencia de `INITIAL` por brecha de 45 días se anota en la `Visit`, no en un plan.
8. **companyId.** No aplica.
9. **Abiertas.** Volver a extraer un plan solo si un mismo `Service` necesitara dos reglas de calendario distintas. Hoy no se necesita.

## Visit

1. **Propósito.** Una ejecución concreta: un día, una ventana prometida y el trabajo real.
2. **Relaciones.** * — 1 `Service`. * — * `Worker` vía `Assignment`. 1 — * `ChecklistRun`, `VisitPhoto`, `Incident`. 0..1 `Claim` como visita originaria. Una visita `CORRECTION` puede ser la revisita de un `Claim`.
3. **Cardinalidad.** Un servicio tiene muchas visitas. Una visita tiene varios trabajadores asignados. Una visita de corrección pertenece también a su servicio, no a un servicio paralelo.
4. **Estados.** `SCHEDULED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `SKIPPED`.
5. **Información.**
   - Servicio, `visitKind` (`INITIAL`, `MAINTENANCE`, `CORRECTION`).
   - `scheduledDate`, `windowStart`, `windowEnd`.
   - `actualStartedAt`, `actualEndedAt`.
   - Copia operativa editable: `estimatedDurationMinutes`, `photosRequired` y los kinds de foto esperados.
   - Sugerencia: `kindSuggestion` y `kindSuggestionReason` (`GAP_THRESHOLD`), vacías si no aplica.
   - Registro de cancelación, cuando pasa a `CANCELLED`: momento, horas hasta `windowStart`, porcentaje de la política, porcentaje aplicado, motivo de la excepción y quién la hizo.
6. **No le pertenece.** El precio. El impuesto. Si el porcentaje de cancelación ya se cobró. La ruta del archivo. El texto de la solicitud. La regla de recurrencia del servicio. El depósito y el saldo.
7. **Reglas.**
   - La ventana por defecto dura 120 minutos y esta visita puede usar otra.
   - Lo prometido es la ventana. Lo trabajado es el inicio y el fin reales. La cancelación mira solo `windowStart`.
   - Al crearla se copian duración y fotos desde los settings del kind. Cambiar el setting no reescribe visitas ya creadas.
   - Referencia copiada, no una validación rígida ni un precio: inicial 4–6 horas con fotos `BEFORE` y `AFTER`; mantenimiento 3–4 horas o menos, fotos no obligatorias.
   - Completar exige las fotos configuradas en esa visita. Si `photosRequired` es falso, se completa sin fotos.
   - La sugerencia de `INITIAL` no cambia el kind. Aceptarla o descartarla queda auditado.
   - `SKIPPED` y `CANCELLED` no cuentan como servicio recibido para la brecha de 45 días.
   - Cancelar calcula `h` hasta `windowStart`: `h > 72` → 0 %; `24 < h <= 72` → 40 %; `h <= 24` → 100 %. Exactamente 72 h es 40 %. Exactamente 24 h es 100 %. Los porcentajes salen de `CancellationPolicy`. Una excepción sustituye el porcentaje aplicado y conserva el calculado.
   - Con la política apagada, el cálculo es 0 % salvo excepción.
   - El buffer de 45 minutos avisa si esta visita queda demasiado cerca de otra del mismo trabajador. No impide guardar.
8. **companyId.** Sí.
9. **Abiertas.** Ninguna de agenda o de kind. Sigue abierto qué documento de cobro nace de una cancelación o de una visita completada.

## Worker

1. **Propósito.** Persona que hace el trabajo de campo.
2. **Relaciones.** 0..1 `User`, vacío en el MVP. * — * `Visit` vía `Assignment`. * — * `Team`.
3. **Cardinalidad.** Una empresa tiene muchos trabajadores. Un trabajador tiene muchas asignaciones. Un trabajador está en cero o varios equipos.
4. **Estados.** Activo o inactivo. Inactivo no entra en asignaciones nuevas.
5. **Información.** Nombre, teléfono, notas, activo.
6. **No le pertenece.** Contraseña, email de acceso, rol, permisos, membresía. El checklist de una visita. El pago al cliente.
7. **Reglas.** Existe sin cuenta. El equipo interno asigna y registra la ejecución. `userId` no se rellena en el MVP.
8. **companyId.** Sí.
9. **Abiertas.** Si más adelante el acceso de campo reutiliza esta fila enlazando un `User`, que es la intención, o si hará falta otro vínculo. El modelo deja `userId` listo y no lo usa.

## Assignment

1. **Propósito.** Decir qué trabajador va a una visita concreta.
2. **Relaciones.** * — 1 `Visit`. * — 1 `Worker`. Quien asigna es un `User`.
3. **Cardinalidad.** Una visita tiene varias asignaciones si va más de una persona. Un trabajador tiene muchas a lo largo del tiempo. Una pareja visita–trabajador no se repite.
4. **Estados.** No tiene ciclo propio. La visita pasa a `ASSIGNED` cuando tiene al menos una asignación, y puede volver a `SCHEDULED` si se quitan todas antes de empezar.
5. **Información.** Visita, trabajador, quién asignó y cuándo.
6. **No le pertenece.** La ventana. El kind. Un equipo como destino de la asignación. El pago al trabajador. La hora real de entrada, que es `actualStartedAt` de la visita.
7. **Reglas.** Asignar un equipo, si se usa, crea una asignación por cada trabajador activo de ese equipo. El equipo no queda como responsable único de la visita. El aviso de buffer mira las asignaciones del mismo trabajador.
8. **companyId.** Sí.
9. **Abiertas.** Si una asignación necesita un papel dentro de la cuadrilla (responsable y apoyo). El MVP no lo distingue.

## Checklist

El checklist son dos cosas: la plantilla de la empresa y la ejecución en una visita. Una sola entidad mezclaría el catálogo con lo que se marcó en una casa.

### ChecklistTemplate

1. **Propósito.** Lista reutilizable de lo que debe revisarse en un kind de visita.
2. **Relaciones.** 1 — * `ChecklistTemplateItem`. La usa un `ChecklistRun`.
3. **Cardinalidad.** Una empresa tiene una plantilla activa por `visitKind` en el MVP (`INITIAL`, `MAINTENANCE`, `CORRECTION`). Cada plantilla tiene varios ítems ordenados.
4. **Estados.** Activa o inactiva.
5. **Información.** Nombre, `visitKind`, ítems con texto, orden y si son obligatorios.
6. **No le pertenece.** Lo marcado en una casa. Fotos. Precios.
7. **Reglas.** Al empezar o preparar la visita se copia la plantilla activa de su kind a un `ChecklistRun`. Cambiar la plantilla después no reescribe corridas ya creadas.
8. **companyId.** Sí.
9. **Abiertas.** Si `CORRECTION` comparte la plantilla de `MAINTENANCE` hasta que Sylvia defina una propia. El modelo permite una plantilla distinta por kind.

### ChecklistRun

1. **Propósito.** La lista realmente usada en una visita, con lo que quedó marcado.
2. **Relaciones.** * — 1 `Visit`. * — 1 `ChecklistTemplate` de origen. 1 — * ítems de corrida. Un ítem puede apuntar a un `File`.
3. **Cardinalidad.** Una visita tiene una corrida en el MVP. Una corrida tiene los ítems copiados de la plantilla.
4. **Estados.** `IN_PROGRESS`, `COMPLETED`.
5. **Información.** Visita, plantilla de origen, ítems con texto copiado, hecho o no, nota y archivo opcional.
6. **No le pertenece.** La ruta física del archivo. El precio. La definición viva de la plantilla.
7. **Reglas.** Completar la visita con ítems obligatorios pendientes no está permitido. Las fotos de antes y después no se sustituyen por ítems del checklist: siguen siendo `VisitPhoto`.
8. **companyId.** Sí.
9. **Abiertas.** Qué pasa con la corrida si alguien cambia el `visitKind` después de haberla creado. El MVP puede pedir confirmar y regenerar la corrida si aún no hay ítems marcados.

## VisitPhoto

1. **Propósito.** Una fotografía de la visita y su significado: antes, después u otra.
2. **Relaciones.** * — 1 `Visit`. * — 1 `File`.
3. **Cardinalidad.** Una visita tiene muchas fotos. Una foto de visita usa un archivo. Un archivo no se reutiliza como otra foto.
4. **Estados.** No tiene. Existe o se elimina junto con su archivo si nadie más lo usa.
5. **Información.** Visita, archivo, kind (`BEFORE`, `AFTER`, `OTHER`), momento de la toma si se conoce, nota corta.
6. **No le pertenece.** `storageKey`, proveedor, mime ni tamaño. Eso es de `File`. Tampoco el análisis de IA.
7. **Reglas.** Si la visita tiene `photosRequired`, completarla exige al menos una `BEFORE` y una `AFTER`, salvo que la copia de esa visita diga otra cosa. En mantenimiento, por la referencia aprobada, las fotos no son obligatorias.
8. **companyId.** Sí.
9. **Abiertas.** Si el cliente podrá ver cada foto en el portal. Hace falta un indicador de visibilidad más adelante; el MVP puede dejarlas internas.

## File

1. **Propósito.** Metadato de un archivo guardado. Separa el dominio del disco o del almacenamiento de objetos.
2. **Relaciones.** Lo referencian `VisitPhoto`, un ítem de `ChecklistRun` y `Incident`. Quien lo sube es un `User`.
3. **Cardinalidad.** Un archivo tiene un dueño de negocio en la práctica. El modelo no le impide ser referenciado por más de un registro, pero la foto, el ítem y el incidente no guardan otra copia del binario.
4. **Estados.** No tiene ciclo de negocio.
5. **Información.** `id`, `companyId`, `storageProvider` (`LOCAL`, `S3`, `OCI`), `storageKey`, `mimeType`, `size`, `originalName`, usuario que subió, fecha.
6. **No le pertenece.** Si es antes o después. Si es evidencia de un incidente. La ruta pública. Esas cosas las dice quien lo referencia.
7. **Reglas.** El dominio solo guarda `fileId`. Leer o borrar pasa por la empresa del archivo. El proveedor local sirve en desarrollo. Un proveedor OCI o S3 futuro no cambia a `VisitPhoto`, al checklist ni al incidente.
8. **companyId.** Sí. Un archivo de otra empresa no se enlaza.
9. **Abiertas.** Tamaño máximo y tipos mime permitidos. Son límites de producto, no de este modelo.

## Incident

1. **Propósito.** Algo ocurrido durante la ejecución, registrado por el equipo: un desperfecto, un acceso imposible, un accidente menor.
2. **Relaciones.** * — 1 `Visit`. Archivos opcionales vía `File`. Quien lo registra es un `User`.
3. **Cardinalidad.** Una visita tiene varios incidentes. Un incidente pertenece a una visita.
4. **Estados.** `OPEN`, `RESOLVED`.
5. **Información.** Visita, descripción, momento, estado, notas de cierre, archivos.
6. **No le pertenece.** El reclamo del cliente. La revisita. El cobro. La ruta del archivo. Convertirse automáticamente en `Claim`.
7. **Reglas.** No bloquea por sí solo completar la visita. No crea una visita de corrección. No genera factura.
8. **companyId.** Sí.
9. **Abiertas.** Si ciertos incidentes deberían sugerir un reclamo. Hoy no hay ese puente automático.

## Claim

1. **Propósito.** El cliente reporta un problema después del servicio. Puede hacer falta volver.
2. **Relaciones.** * — 1 `Visit` de origen. 0..1 `Visit` de revisita, con `visitKind = CORRECTION`.
3. **Cardinalidad.** Una visita de origen puede tener varios reclamos. Una revisita corrige un reclamo. La revisita sigue colgando del mismo `Service`.
4. **Estados.** `OPEN`, `REVISIT_SCHEDULED`, `RESOLVED`, `DISMISSED`.
5. **Información.** Visita de origen, descripción, momento de apertura, estado, notas de resolución, visita de corrección si se agenda.
6. **No le pertenece.** El depósito, el saldo, retener un cobro, condonar, el impuesto, ni la decisión de si la revisita se cobra. Tampoco el incidente interno, que es otra entidad.
7. **Reglas.** Abrir un reclamo no cambia el dinero, porque esas reglas no existen todavía. Agendar la revisita crea una `Visit` `CORRECTION` y pasa el reclamo a `REVISIT_SCHEDULED`. La referencia de unas 24 horas es un setting editable (`claims.windowHours`) y no es, por ahora, una barrera de cobro ni un rechazo automático.
8. **companyId.** Sí.
9. **Abiertas.** Todas las de dinero: si el saldo espera, si el reclamo lo retiene, si la revisita se cobra, y si pasado el plazo ya no se abre un reclamo. Sylvia primero. El modelo operativo de arriba puede quedarse así sin esas respuestas.

## Invoice

1. **Propósito.** Documento con el que la empresa le pide dinero a un cliente. Se nombra ahora para no usar la cotización como si fuera la factura.
2. **Relaciones.** * — 1 `Client`. 1 — * `InvoiceLine`. 1 — * `Payment`. El vínculo con `Quote`, `Service` o `Visit` se reserva y no se fija.
3. **Cardinalidad.** Un cliente puede tener muchas facturas. Una factura tiene muchas líneas y muchos pagos. Cuántas facturas nacen de una visita está abierto.
4. **Estados.** Sin ciclo aprobado. No se adoptan `HELD`, depósito ni saldo como estados del modelo.
5. **Información mínima, todavía no cerrada.** Cliente, moneda USD, fecha y líneas. Nada más se da por aprobado.
6. **No le pertenece.** La política de cancelación en sí (el porcentaje ya quedó en la visita). El alcance de la cotización. El sales tax, mientras el CPA no lo confirme. La pasarela de pago. La regla de depósito y de saldo.
7. **Reglas.** Ninguna regla de emisión, vencimiento o retención está aprobada. Una visita completada no crea factura por sí sola en este modelo. Una cancelación guarda su porcentaje y no crea una línea de factura por sí sola.
8. **companyId.** Sí, cuando la entidad se diseñe de verdad.
9. **Abiertas.** Ver el bloque final de billing. Esta entidad no se pasa al diseño físico hasta cerrarlas.

## InvoiceLine

1. **Propósito.** Una línea de ese documento: concepto e importe a cobrar.
2. **Relaciones.** * — 1 `Invoice`.
3. **Cardinalidad.** Una factura tiene una o varias líneas. Una línea tiene una sola factura.
4. **Estados.** No tiene.
5. **Información.** Descripción, cantidad, precio e importe, cuando el documento exista. La moneda es la de la factura.
6. **No le pertenece.** Ser una copia obligatoria de `QuoteLine`. El impuesto. La distinción depósito/saldo/cargo por cancelación, hasta que Sylvia la confirme. Esos papeles no se fijan como tipos de línea.
7. **Reglas.** No se calcula desde pies cuadrados ni desde el kind de la visita. No nace automáticamente de una `QuoteLine`.
8. **companyId.** Sí, cuando exista.
9. **Abiertas.** Si una línea podrá apuntar a una visita, a una cotización o a ninguna. Y si el porcentaje de cancelación se expresa como una línea.

## Payment

1. **Propósito.** Dinero recibido de un cliente y aplicado a una factura.
2. **Relaciones.** * — 1 `Invoice`. Quien lo registra es un `User`.
3. **Cardinalidad.** Una factura puede recibir varios pagos. Un pago se aplica a una factura en este concepto. No se modela un pago huérfano ni una pasarela.
4. **Estados.** No tiene un ciclo aprobado más allá de quedar registrado. Anular un pago queda abierto.
5. **Información prevista, no cerrada.** Importe, momento, una referencia libre y el medio, cuando se sepa qué medios existen.
6. **No le pertenece.** El cálculo del 72/24. El saldo retenido por un reclamo. El sales tax. Datos de tarjeta o de una pasarela.
7. **Reglas.** Ninguna regla de “cuándo se cobra” está aprobada. Registrar el pago no forma parte del MVP hasta cerrar billing.
8. **companyId.** Sí, cuando exista.
9. **Abiertas.** Medios de pago. Pagos parciales. Condonación. Qué pasa con la factura cuando la suma de pagos la cubre.

## Expense

1. **Propósito.** Gasto de la empresa, no precio al cliente.
2. **Relaciones.** Pertenece a `Company`. Un enlace opcional a `Visit` o a `Worker` no está decidido.
3. **Cardinalidad.** Una empresa tiene muchos gastos. Un gasto no es una línea de factura.
4. **Estados.** No tiene ciclo aprobado.
5. **Información mínima.** Concepto, importe, moneda USD, fecha. El resto espera.
6. **No le pertenece.** `QuoteLine`, `InvoiceLine`, el cobro al cliente, el impuesto repercutido.
7. **Reglas.** No entra en la cotización ni en el precio de la visita. No se diseña el flujo hasta que el cobro al cliente esté definido, para no inventar categorías y reembolsos en vacío.
8. **companyId.** Sí, cuando exista.
9. **Abiertas.** Categorías, comprobante, si se ata a una visita o a un trabajador, y si entra en los reportes del primer corte.

---

## Entidades de soporte que el plan ya exige

No son el centro del mapa, y el modelo quedaría incompleto sin ellas.

### Team

Agrupa trabajadores de una empresa para asignarlos juntos. No tiene visitas propias. Asignar un equipo crea `Assignment` por trabajador. `companyId` sí. Abierto: solo si hace falta un responsable fijo del equipo. No bloquea.

### CancellationPolicy y CancellationPolicyTier

Una política por empresa: activa o no, referencia `WINDOW_START`. Sus tramos son datos, no código. El seed de Azul Cerezo expresa: por encima de 72 horas, 0 %; desde más de 24 hasta 72 inclusive, 40 %; 24 horas o menos, 100 %. `companyId` sí, en la política. No guarda el resultado de una visita concreta: eso queda en el registro de cancelación de la `Visit`. Abiertas: ninguna de la fórmula. Sigue abierto cómo ese porcentaje se convierte en dinero.

### CompanySetting

Pares de configuración que no merecen entidad propia: `defaultWindowMinutes` = 120, `schedule.bufferMinutes` = 45, `recurrence.gapResetDays` = 45, `claims.windowHours` = 24 como referencia, duraciones y fotos por kind. `companyId` sí. La política de cancelación no se esconde aquí: tiene entidad porque tiene tramos. Abierto: cualquier setting de impuesto o de depósito. Esos no se siembran como si ya estuvieran decididos.

### AuditLog

Hechos que hay que poder reconstruir: envío de cotización, dispensa de evaluación, cancelación con ambos porcentajes, aceptar o descartar la sugerencia de `INITIAL`, cambio manual de kind, alta y baja de usuarios, cambios de settings. Lleva empresa, actor, acción, tipo de entidad, id, descripción y metadatos. `companyId` sí. El actor es un `User`, no un lead. Abiertas: ninguna de este corte.

### Notification

Aviso interno para un usuario de la empresa. `companyId` sí. Correo y WhatsApp no son esta entidad. Abiertas: qué eventos crean aviso en el MVP. El modelo basta con destinatario, tipo, texto, leído y fecha.

---

## Decisiones abiertas antes del diseño físico

### Billing, pagos y sales tax

No pasan al schema hasta confirmarlas. Sylvia primero. El CPA después.

Con Sylvia:

- Si al aceptar hay depósito y después saldo, o un solo cobro.
- Si algún cobro espera unas 24 horas después de completar la visita.
- Si un `Claim` abierto retiene ese cobro.
- Si la visita `CORRECTION` se cobra.
- Sobre qué monto se aplica el porcentaje de cancelación ya calculado, y cuándo ese porcentaje se vuelve exigible.
- Qué medios de pago se registran.
- Si `Invoice` nace de la cotización aceptada, de cada visita, de ambas o de un alta manual.

Con el CPA:

- Si la limpieza residencial en Florida lleva sales tax.
- Tasa, base y si el impuesto es una línea aparte.
- Qué comprobante recibe el cliente.

Mientras tanto, `Invoice`, `InvoiceLine`, `Payment` y `Expense` no se detallan en PostgreSQL. La cancelación sí se puede modelar: guarda horas y porcentajes en la visita.

### Otras, más pequeñas

- Si el teléfono del lead es único por empresa.
- Qué ocurre con las demás cotizaciones cuando una se acepta.
- Si se puede retirar una cotización ya enviada.
- Si un `Service` puede nacer sin cotización.
- Qué rasgos del alcance se copian a `Property` la primera vez.
- Si cambiar el kind de una visita regenera el `ChecklistRun`.
- Si `CORRECTION` tiene plantilla propia.
- Papel dentro de la cuadrilla en `Assignment`.

Ninguna de esas obliga a cerrar el dinero.
