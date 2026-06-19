# Changelog

All notable changes to Rumbo are documented here.

---

## [1.17.0] — 2026-06-19 — forms: react-hook-form + zod con validación en cliente

### Changed — los 7 formularios de entidad ahora usan react-hook-form + zod

- **Validación en cliente con errores en línea.** Antes los formularios sólo
  tenían `required` de HTML y botones deshabilitados; ahora cada campo valida
  contra un esquema zod y muestra el error debajo del campo (placa o unidad
  obligatoria, conductor/vehículo obligatorio, monto > 0, calificación 0–5,
  año 1900–2100, etc.).
- **Esquemas centralizados y probados** en `src/lib/schemas.js` (uno por
  formulario), con **15 pruebas unitarias** nuevas que cubren campos
  obligatorios, rangos y coerción de números.
- Formularios convertidos: Vehículo, Conductor, Multa, Combustible, Reclamo de
  seguro, Mantenimiento y Nuevo canal.
- Los errores del servidor al guardar se muestran con `setError('root')`; el
  estado de envío usa `formState.isSubmitting`. Las cargas de archivos
  (fotos/documentos) siguen igual y guardan la URL con `setValue`.
- Sin cambios en la forma de los datos enviados al backend ni en la UI: misma
  estructura de payload, sólo se añade validación.

## [1.16.0] — 2026-06-19 — rediseño: tema claro/oscuro y estética "consola de operaciones"

### Added — tema claro + oscuro

- **Selector de tema claro/oscuro** (next-themes, ya en dependencias). El tema oscuro se
  mantiene idéntico al original y sigue siendo el predeterminado; se añade un tema **claro**
  completo. El selector está en el pie de la barra lateral.
- Las variables de color son semánticas, así que ambos temas funcionan en toda la app sin
  tocar componentes. **El branding white-label sigue mandando**: los colores del tenant
  (`applyTenantColors`) se aplican por encima de cualquier tema.

### Changed — estética "consola de operaciones" (data-forward)

- **Tipografía de datos en monoespaciada** (IBM Plex Mono con cifras tabulares): los KPIs del
  dashboard, las placas/unidades, los montos ($) de Rentas/Financiero/Licencia y los códigos
  se renderizan en mono para que los números se alineen y los identificadores se lean como
  datos. Es el elemento distintivo del rediseño.
- Radios de borde más nítidos (`--radius` 0.5rem → 0.375rem) para un acabado más técnico.

### Accessibility (de 1.15.x)

- Foco de teclado visible global (`:focus-visible`) y soporte de `prefers-reduced-motion`.

## [1.15.0] — 2026-06-19 — refactor: capa de datos completa y componentización

Refactor interno (sin cambios de comportamiento para el usuario). Continúa la migración
iniciada en 1.14.0.

### Changed — todas las páginas sobre la capa de datos React Query

- Migradas el resto de las páginas fuera del patrón manual `useState + useEffect`:
  **Mantenimiento, Financiero, Alertas, Catálogos, Ubicación, Enlaces útiles, Mensajes,
  Licencia (Billing) y las páginas del conductor** (Inicio/Perfil/Viajes).
- Nuevos hooks compartidos en `src/hooks/useEntities.js`: `useMe()` (perfil en caché),
  `useCurrentDriver()` (resuelve la búsqueda usuario→conductor que repetían las 3 páginas
  del conductor) y `useRawList()` (lecturas sin scope de tenant: `TenantLicense`, `User`).
- El refetch manual `load()` se reemplaza por invalidación de caché en toda la app.

### Changed — componentización de los archivos monolíticos

- **`Rentas.jsx` 635 → 308 líneas**: extraídos `src/components/rentas/` (rentUtils,
  ManualChargeModal, IngresosView, ReferralsView).
- **`Admin.jsx` 728 → 173 líneas**: extraídos `src/components/admin/` (roleConfig, UserRow,
  InviteForm, TenantEditor, JoinCodeCard, DangerZone).

### Added — primitivos de UI compartidos

- `ResponsiveModal` (hoja inferior en móvil / diálogo centrado en escritorio) y `FormError`,
  reemplazando markup duplicado en los modales. Un único `Spinner`/`PageLoader` reemplaza
  ~20 copias del spinner.

## [1.14.0] — 2026-06-19 — capa de datos, permisos y onboarding

### Changed — migración a React Query y capa de datos por tenant

- **Capa de datos centralizada** (`src/hooks/useEntities.js`): las páginas ya no obtienen
  datos con `useState + useEffect + Promise.all` ni un flag `loading` manual. Se introduce
  una capa sobre el SDK de Base44 basada en React Query (`useEntityList` +
  `useVehicles/useDrivers/useAlerts/useMessages/useRentCharges` y `useInvalidateEntity`),
  con caché, deduplicación de peticiones y refetch declarativo tras cada cambio. React Query
  ya estaba montado en `App.jsx` pero sin usarse. Migradas en esta versión: **Dashboard,
  Vehículos, Conductores, Mantenimiento, Financiero, Alertas y Catálogos**.
- **Spinner compartido** (`src/components/ui/spinner.jsx`): un único componente
  `Spinner` / `PageLoader` reemplaza ~20 copias del mismo markup repartidas por las páginas.

### Changed — permisos por rol

- **Admin y Owner siempre con acceso total y visible**: el panel *Permisos por Rol* ahora
  muestra una pestaña **Admin** (y Owner) con **todos los permisos activados**, bloqueada y
  no configurable, para ver el conjunto completo de un vistazo en lugar de solo un aviso.
- **Permisos nuevos por defecto en "Ver"**: cuando se agrega un módulo o acción nuevo al
  sistema, los roles no-admin lo reciben en **solo lectura** (`view: true`, escritura
  desactivada) en vez de quedar sin acceso. Implementado en `moduleCan` / `defaultPerm` con
  `NEW_PERMISSION_DEFAULT`, sin alterar los defaults explícitos ya existentes (verificado por
  los 296 tests unitarios).

### Added — onboarding guiado: crear o unirse a una organización

- **Hub de onboarding** (`src/pages/Onboarding.jsx`): cualquier usuario autenticado que aún
  no pertenece a un tenant pasa por una pantalla que lo guía a **crear su organización**
  (prueba de 30 días, sin tarjeta) o **unirse a una existente con un código**. Antes, un
  usuario que entraba con un correo externo caía directo en una app vacía, sin guía ni aviso.
- **Código de unión único por tenant** (`join_code` en `TenantLicense`): se genera al crear
  la organización y se muestra/copia/regenera desde **Administración**. Alfabeto sin
  caracteres ambiguos (sin 0/O/1/I/L) para dictarlo y teclearlo sin errores en el teléfono.
- **`createTenant`** (función de servidor): crea la organización y eleva al usuario a owner
  de forma controlada. Necesario porque un usuario recién registrado entra con rol `user` y
  la RLS no le permitiría crear el tenant ni cambiarse el rol desde el cliente.
- **`joinTenant`** (función de servidor): valida el código con service role (resuelve el
  huevo-gallina de RLS) y une al usuario con **privilegio mínimo** (`conductor`); el admin
  lo promueve después. No se puede unir a un tenant cancelado/suspendido.

### Added — gestión de miembros del tenant

- **Suspender / reactivar / quitar** usuarios desde Administración, vía **`manageMember`**
  (función de servidor): `write_access`, `suspended` y `tenant_id` son server-authoritative.
  Protege al owner del tenant y al owner de la app; nadie puede actuar sobre sí mismo.
- **Nombre para la app** (`display_name` en `User`): el admin asigna un nombre visible
  asociado al correo; si está vacío se usa el `full_name` de la cuenta.
- **Visibilidad del owner de la app**: la página de Licencias ahora muestra el código de
  unión y los correos de los miembros de cada tenant.

### Mobile

- Onboarding y pantallas de unión rediseñados mobile-first: objetivos táctiles grandes
  (h-12), inputs de 16px (evitan el zoom de iOS) y `safe-area` para el notch.

---

## [1.13.1] — 2026-06-17

### Changed — se usa el logo PNG oficial (provisto por el cliente)

- Se reemplaza la recreación en SVG por el archivo oficial **`public/rumbo.png`** (1024×1024).
- App: favicon (`index.html`), `LogoMark` (`Layout.jsx`) y onboarding (`TenantOnboarding.jsx`)
  apuntan a `/rumbo.png`.
- Landing `marketing/precios.html`: usa `rumbo.png` (relativo) — debe subirse en la misma
  carpeta que el HTML en el sitio externo.
- Se elimina `public/rumbo-logo.svg` (ya no se usa).

### Version

- `package.json` version `1.13.0` → `1.13.1`.

---

## [1.13.0] — 2026-06-17

### Added — logo oficial de Rumbo (dentro y fuera de la app)

- **`public/rumbo-logo.svg`**: logo oficial (auto de frente con pin de ubicación, blanco
  sobre verde) como SVG escalable. Una sola fuente, se sirve en `/rumbo-logo.svg`.
- **Dentro de la app**: el fallback de marca (`LogoMark` en `Layout.jsx`) y el onboarding
  (`TenantOnboarding.jsx`) ahora muestran el logo oficial en vez de la "R". El logo propio
  de cada tenant sigue teniendo prioridad donde aplica.
- **Favicon y título**: `index.html` usa el logo como favicon y el título pasa de
  "Base44 APP" a "Rumbo" (se quitó el `<link rel="manifest">` que apuntaba a un archivo
  inexistente).
- **Fuera de la app**: la landing `marketing/precios.html` usa el logo (SVG inline, sigue
  siendo un solo archivo autocontenido).

### Version

- `package.json` version `1.12.0` → `1.13.0`.

---

## [1.12.0] — 2026-06-17

### Added — planes comerciales con cupos de vehículos/conductores

Definición de los niveles de licencia y aplicación de sus cupos (antes `max_vehicles` /
`max_drivers` eran solo informativos).

- **`src/lib/plans.js`**: `PLAN_LIMITS` (trial 5/5, starter 15/20, pro 50/75, enterprise
  ilimitado), `PLAN_LABELS` (Prueba / Starter / Pro / Flotilla) y helpers
  `vehicleLimit()` / `driverLimit()` / `atVehicleLimit()` / `atDriverLimit()`. El cupo
  efectivo es `license.max_vehicles` (si está definido) y, si no, el default del plan;
  `0` / vacío = ilimitado.
- **Gate de creación** en `Vehicles.jsx` y `Drivers.jsx`: al alcanzar el cupo, se bloquea
  la creación con un mensaje de "mejora tu plan". El encabezado muestra `usados / cupo`.
- **Billing.jsx** muestra el cupo del plan (∞ para ilimitado) en vez del fijo "5".
- **SuperAdminPanel**: al cambiar el plan de un tenant se prellenan `max_vehicles` /
  `max_drivers` con los defaults del plan (editables); `0 = ilimitado` en el formulario y
  "Ilimitado" en la vista.
- **Tests**: +7 sobre cupos y límites.

> Alcance: el gate de cupos se aplica en el **frontend** (no es una frontera de seguridad;
> exceder el cupo no expone datos de nadie). Una aplicación dura a nivel de datos exigiría
> enrutar la creación por una función de servidor que cuente los registros del tenant.
> Tampoco se restringen módulos por plan todavía (los planes se diferencian por cupo).

### Version

- `package.json` version `1.11.2` → `1.12.0`.

---

## [1.11.2] — 2026-06-17

### Fixed — el acuse "entregado/leído" del conductor ahora sí persiste (RLS de Message)

Complemento de 1.11.1: aunque el conductor ya podía **leer** los mensajes, su acuse de
"entregado/leído" no se guardaba porque la RLS de `update` de `Message` solo permitía al
creador o al staff (fallaba en silencio en `loadMessages`).

- **RLS de `update` de `Message` extendida** a los destinatarios del canal
  (`channel_kind == "broadcast"` o `channel_driver_id == driver_profile_id`), igual que la
  de lectura.
- **Protección a nivel de campo (field-level `write`)** en `tenant_id`, `channel_id`,
  `channel_kind`, `channel_driver_id`, `sender_id`, `sender_name`, `body` y `audio_url`:
  solo el **creador o el staff** pueden escribirlos. Así un destinatario que pasa la RLS de
  update **solo** puede tocar `delivered` / `read`, nunca el contenido del mensaje (mismo
  patrón field-level que `User.role`). El gate de licencia (`write_access`) se mantiene.
- No requiere cambios de frontend: `Messages.jsx` ya marcaba `delivered`/`read` al abrir el
  canal; ahora la escritura es aceptada para el destinatario.

### Version

- `package.json` version `1.11.1` → `1.11.2`.

---

## [1.11.1] — 2026-06-17

### Fixed — los conductores no podían leer los mensajes que les enviaban (RLS de Message)

El advisor de seguridad de Base44 marcaba `Message` porque su RLS de lectura solo dejaba
leer a staff (owner/admin/dispatcher) y al **propio remitente** (`sender_id == user.id`).
Un conductor no podía leer los mensajes que le enviaban (broadcast o su canal directo),
porque esos mensajes llevan el `sender_id` del staff, no el suyo — el chat quedaba roto
del lado del conductor.

- **Nuevos campos denormalizados en `Message`: `channel_kind` y `channel_driver_id`**,
  copiados de `Channel.kind` / `Channel.driver_id` al crear el mensaje. Las RLS de Base44
  no hacen joins, así que la pertenencia al canal debe viajar en el propio mensaje.
- **RLS de lectura de `Message` extendida** para espejar la de `Channel`: además de staff
  y remitente, ahora deja leer cuando `channel_kind == "broadcast"` (todo el tenant) o
  `channel_driver_id == {{user.data.driver_profile_id}}` (canal directo del conductor).
  La escritura no cambia y el aislamiento por `tenant_id` se mantiene.
- **`Messages.jsx`** ahora setea `channel_kind` y `channel_driver_id` al crear mensajes
  de texto y de voz.

> Nota de deploy: los mensajes creados **antes** de este cambio no tienen los campos
> denormalizados, así que un conductor seguirá sin poder leer el histórico previo. Si
> hace falta, hay que hacer un backfill (copiar kind/driver_id del canal a sus mensajes).
> Pendiente aparte: el acuse "entregado/leído" del conductor aún no persiste porque la
> RLS de `update` de `Message` solo permite al creador o al staff (falla en silencio, sin
> regresión); habilitarlo requeriría permiso de update acotado al destinatario.

### Version

- `package.json` version `1.11.0` → `1.11.1`.

---

## [1.11.0] — 2026-06-17

### Added — bloqueo de escritura por licencia, aplicado en el backend (no solo UI)

Hasta ahora el corte por falta de pago (`readonly` / `disabled`) se aplicaba **solo en el
frontend**: un tenant vencido seguía pudiendo escribir si llamaba al SDK directamente,
porque las RLS solo validaban rol + tenant. Esto cierra ese hueco para comercializar la app.

- **Nuevo campo server-authoritative `write_access` (`enabled` | `blocked`) en `User`**
  (`rls.write: false`). Solo lo escribe `resolveTenant` con service role; el cliente no
  puede tocarlo.
- **`resolveTenant` calcula `write_access`** desde el estado de la licencia, con la misma
  política que `src/lib/license.js`: `enabled` mientras está `active` o en gracia
  `past_due` (1–7 días vencida); `blocked` al pasar a `readonly` (8–15 días),
  `disabled` (16+), `suspended` o `cancelled`. El owner de la app nunca se autobloquea.
- **RLS de `create` / `update` / `delete` endurecida en las 18 entidades operativas**
  (Vehicle, Driver, Trip, Maintenance, Part, Fine, FuelLog, InsuranceClaim, RentCharge,
  Alert, Message, Channel, DriverDocument, VehicleDocument, DriverPrivateNote,
  LocationRequest, Catalog, UsefulLink): ahora exigen
  `user_condition: { write_access: "enabled" }`. La **lectura no cambia** (la app queda
  en solo lectura). Un tenant vencido recibe error de RLS aunque le pegue al SDK.
- **Frontend:** `isWriteBlocked()` en `license.js` y `writeBlocked` en `TenantContext`;
  el contexto revalida tenant/licencia cada 15 min y al volver el foco a la pestaña, para
  que una sesión abierta que cruza la fecha de vencimiento no conserve permiso de escritura.
- **Tests:** +7 casos sobre el mapeo estado-de-licencia → bloqueo de escritura.

> Nota de frescura: `write_access` se recalcula cada vez que el cliente llama a
> `resolveTenant` (carga de la app + revalidación cada 15 min + al enfocar). Para que el
> corte sea totalmente independiente del cliente, conviene programar una ejecución diaria
> de `resolveTenant` (o una función equivalente) como tarea programada en el panel de Base44.

### Version

- `package.json` version `1.10.0` → `1.11.0`.

---

## [1.10.0] — 2026-06-16

### Added — Enlaces útiles (per-tenant external links)

- **New `UsefulLink` entity** (tenant-scoped): `label`, `url`, `description`, `active`,
  `sort_order`. Owner/admin manage; the whole tenant reads.
- **New "Enlaces útiles" page** (`/links`) in the main nav: each tenant's admin adds links
  to the external systems they use (e.g. their GPS, the fines portal), and any tenant user
  opens them in a new tab from inside the app. URLs are auto-normalized to `https://`.
  This replaces the idea of integrating those external apps — they stay separate, just
  linked. Read-only license hides the management controls.

### Version

- `package.json` version `1.9.1` → `1.10.0`.

---

## [1.9.1] — 2026-06-16

### Fixed

- **CSV Import created records without `tenant_id`** (same bug class as the original save
  bug) — imported drivers/vehicles would be rejected/orphaned by RLS. Now stamps
  `tenant_id`, supports `no_unidad` (unit number) for vehicles, removes the obsolete
  `vencimiento_medico` column, guards against read-only license / missing tenant, and
  reports partial failures instead of failing silently.

### Version

- `package.json` version `1.9.0` → `1.9.1`.

---

## [1.9.0] — 2026-06-16

### Added — granular permissions now enforced in the UI

- **`src/lib/modulePerms.js`** + `useModulePerms()`: the per-role/module/action config saved
  by the PermissionsPanel now actually gates the UI (owner/admin always full). Create/edit
  actions are blocked in Drivers, Vehicles, Maintenance, Parts and Financial when the
  tenant's config (or the role default) denies them. The entity RLS remains the hard
  backstop; this layer can only be equal or more restrictive.
- PermissionsPanel now shares the single `DEFAULT_PERMISSIONS` source and includes a
  **Rentas** module row. `TenantContext` exposes `userRole`.

### Added — referral bonus (business rule)

- **Rentas → Referidos** tab: lists each referrer and their referred drivers with on-time
  weekly-payment progress (X/4). When a referred driver reaches **4 on-time weekly
  payments** (paid by the collection day), an **Aplicar bono $1,000** action discounts the
  referrer's open charge and marks the bonus as paid (`Driver.referral_bonus_paid`),
  preventing double application.

### Added — more catalog wiring

- **Vehicle make** dropdown now offers tenant catalog suggestions (`vehicle_make`).

### Notes

- Non-referred "daily + advance" scheme is supported today with existing tools: set the
  unit's `rent_frequency = daily` and use **Cobro manual** to charge in advance.

### Version

- `package.json` version `1.8.0` → `1.9.0`.

---

## [1.8.0] — 2026-06-16

### Added — configurable catalogs (admin-defined, app-consumed)

- **New `Catalog` entity** (tenant-scoped): `category`, `label`, `active`, `sort_order`.
  Managed by owner/admin, readable by the whole tenant.
- **`useCatalog(category)` hook + `src/lib/catalogs.js`**: dropdowns read tenant catalog
  values, falling back to sensible defaults when none are defined yet (so the app works
  out of the box and the admin can override).
- **New Catálogos page** (`/catalogs`, owner/admin): create / activate / deactivate /
  delete values per category (fine types, payment methods, vehicle makes to start).
- **Wired dropdowns** to catalogs: fine types (FineForm) and payment methods (Rentas).

### Added — read-only enforcement (license)

- When the license is in **read-only** state, the primary write actions are blocked:
  Drivers, Vehicles, Rentas (generate/manual/pay), Financial, Maintenance and Parts hide
  their add/register buttons, and Drivers/Vehicles save handlers refuse writes with a
  clear message.

### Version

- `package.json` version `1.7.0` → `1.8.0`.

---

## [1.7.0] — 2026-06-16

### Added — SuperAdmin "Licencias" panel (app owner)

- **App owner identity** via `APP_OWNER_EMAIL` env var (default `h.josepablo@gmail.com`).
  `resolveTenant` now returns `is_app_owner`, surfaced through `TenantContext`.
- **New `licensesAdmin` edge function** — app-owner-only (the single legitimate
  cross-tenant exception, service-role): `list` all licenses, `renew` (confirm payment →
  extends `current_period_end` by month/year, sets `last_payment_at`, status active),
  `set_status` (active/suspended/cancelled/expired manual override). Per-tenant RLS stays
  intact for everyone else.
- **New `/licenses` page**, shown only to the app owner: all tenants with state badge,
  vigencia, admin email, member count; buttons **Confirmar pago mensual / Renovar anual**
  and a status override. Mercado Pago charges independently; this is the manual
  verify-and-renew flow.

### Version

- `package.json` version `1.6.0` → `1.7.0`.

---

## [1.6.0] — 2026-06-16

### Added — license lifecycle (iteration 1: client-facing gating)

- **License state machine** (`src/lib/license.js`): from `current_period_end` (or trial),
  computes `active → past_due (1–7 días vencidos) → readonly (8–15) → disabled (16+)`.
  `status: suspended|cancelled` forces immediate disable (owner override).
- **Free first month**: onboarding sets `current_period_end = hoy + 1 mes`.
- **Tenant banner** for upcoming/overdue payment, **read-only flag** exposed via
  `TenantContext`, and a full **"Acceso desactivado / Contacta a soporte"** screen at day 16.
- New `TenantLicense` fields: `current_period_end`, `billing_cycle`, `last_payment_at`.

### Pending (next iterations)

- SuperAdmin "Licencias" panel for the app owner (confirm payment / renew across tenants).
- Mercado Pago auto-billing integration.
- Per-form write-blocking while read-only.
- Configurable catalogs (no hardcoded dropdowns).
- Server-side enforcement of the granular PermissionsPanel.

### Version

- `package.json` version `1.5.0` → `1.6.0`.

---

## [1.5.0] — 2026-06-16

### Added — robust, server-side tenant assignment

- **New `resolveTenant` edge function.** Single source of truth for binding a user to
  their tenant. Runs with service role (no client-RLS chicken-and-egg): resolves the tenant
  by `created_by` → `owner_email` → `members[]`, persists `tenant_id` on the profile, and
  on an invited user's **first** login applies the role recorded in `members[]` (later role
  changes stay with the tenant admin). Scales to many tenants.
- **`TenantContext` now calls `resolveTenant`** as the primary path, with client-side
  discovery only as a fallback. Removed the unsafe `all[0]` fallback that, under
  multi-tenancy, could bind a user to the wrong tenant.

### Version

- `package.json` version `1.4.0` → `1.5.0`.

---

## [1.4.0] — 2026-06-16

### Security — multi-tenant isolation hardening (before first real tenant onboards)

- **[HIGH] `TenantLicense` cross-tenant read fixed.** Any `admin` could previously read
  **every** tenant's license (incl. `members[]` emails/names, `owner_email`, `notes`).
  Read is now scoped to tenants you created (`created_by_id`), own (`owner_email`), or
  are a member of (`members.email`). Removed the blanket `role: admin reads all` rule.
- **[HIGH] `TenantLicense` cross-tenant write fixed.** Any `admin`/`owner` could previously
  **update any** tenant's license (suspend it, change its plan, raise its own limits).
  Update now requires you to belong to that tenant (creator / owner_email / member with
  owner|admin role).
- **[HIGH] `User` cross-tenant access fixed.** Removed the global `role: owner` branches
  that let a tenant owner read/update **all** platform users. User read/update are now
  scoped to the same `tenant_id` (own record always allowed).
- **Invited users are now bound to their tenant.** Inviting a user records them in the
  tenant's `members[]`, which is what ties them to the tenant (drives the `members.email`
  RLS and reliable tenant discovery on first login — previously discovery fell back to
  "first tenant", which is wrong under multi-tenancy).
- **Dev/integration functions locked to `owner`.** `supabaseData`, `githubRepos`, and
  `createTestData` were callable by any `admin` of any tenant (service-role access to the
  connected Supabase/GitHub, or test-data writes). Now owner-only. The GitHub/Supabase
  pages are owner-only too. `createTestData` no longer falls back to another tenant when
  the caller has no tenant.

### Version

- `package.json` version `1.3.0` → `1.4.0`.

---

## [1.3.0] — 2026-06-16

### Added

- **Rentas → vista de Ingresos**: nuevo reporte de pagos recibidos. En modo **Día**
  muestra cuánto entró y **de quién** (cada pago: conductor, unidad, método, monto); en
  modo **Semana** muestra el total, el ingreso por conductor y **quién quedó debiendo y
  cuánto**. Resuelve la necesidad de ver ingreso diario (varios choferes pagan diario) vs.
  ingreso semanal con adeudos.
- **Conductores → Referido**: campo **"Referido por (conductor)"** en el formulario y badge
  **Referido** en lista y expediente. (La automatización del bono de $1,000 — al cumplir el
  referido sus pagos puntuales, descontándolo de la renta del que refiere — queda como
  siguiente paso.)
- **Día de cobro por unidad** (`Vehicle.rent_day`): la renta semanal se cobra en distintos
  días según la unidad; el generador de cobros ancla la semana al día de cada unidad.

### Changed

- **Placa ahora opcional**: el identificador operativo es el **No. de unidad** (U01, U02…).
  Las vistas usan la unidad como respaldo cuando no hay placa.

### Data Model

- `Vehicle`: `rent_day` added; `plate` no longer required.

### Version

- `package.json` version `1.2.0` → `1.3.0`.

---

## [1.2.0] — 2026-06-16

### Added — Rentas model (core business)

The fleet rents units to drivers (not trip dispatch). This release adds rent tracking
with **partial payments** and **per-driver outstanding balances** — the operator's main
pain point ("se me junta el saldo negativo cuando no pagan completo").

- **Per-unit tariff** on `Vehicle`: `rent_amount` and `rent_frequency` (`weekly` default,
  `daily`). Tariff and frequency vary per unit, as in the real operation.
- **New `RentCharge` entity** — one charge per period per unit: `amount_due`,
  `amount_paid`, `status` (pending/partial/paid), and a `payments[]` history (amount,
  date, method, note). Tenant-scoped RLS (owner/admin/dispatcher manage; drivers can read
  their own).
- **New Rentas page** (`/rentas`):
  - KPIs: **Cobrado hoy**, **Por cobrar**, **Choferes con adeudo**.
  - **Saldo pendiente por conductor** — accumulates partial shortfalls into a running
    balance per driver.
  - **Generar cobros del periodo** — creates the current week/day charge for each active
    unit with a tariff and an assigned driver (skips duplicates).
  - **Registrar pago** — supports partial payments; updates balance and status.
  - **Cobro manual** — ad-hoc charge for advance/daily collection.
  - Filters: pendientes / parciales / vencidos / pagados; search by unit or driver.
- **Driver `referred_by_driver_id`** — captures the referral relationship (referral-bonus
  automation is a follow-up; rules still being defined).
- **Dashboard** now reflects rentas: **Ingresos hoy = rentas cobradas**, plus **Por
  cobrar** and **Disponibilidad operativa** (`activos / total`).
- **Financiero**: removed the **Combustible** tab (no aplica — the driver pays fuel).

### Data Model

- `Vehicle`: added `rent_amount`, `rent_frequency`.
- `Driver`: added `referred_by_driver_id`.
- New entity `RentCharge`.

### Version

- `package.json` version `1.1.0` → `1.2.0`.

---

## [1.1.0] — 2026-06-16

### Fixed

- **[HIGH] Drivers/Vehicles save hangs and does not persist.** Root cause: entity RLS
  requires `data.tenant_id == user.data.tenant_id`, but the user's `tenant_id` was
  persisted via a fire-and-forget `updateMe()` that was not awaited and swallowed
  errors, so a freshly-onboarded user could save before their profile had the tenant.
  `TenantContext` now awaits `updateMe`, and `TenantOnboarding` sets `tenant_id`
  immediately after creating the license. `DriverForm`/`VehicleForm` now use
  `try/catch`, always reset the saving state, and surface a clear inline error instead
  of spinning on "Guardando..." forever. `Drivers`/`Vehicles` guard `create` when the
  tenant is not ready yet.

### Changed (client feedback — quick wins)

- **Conductores:** removed *Certificado médico* (no aplica). Added per-driver document
  uploads: **Licencia, INE, Comprobante de domicilio** (each a separate file field,
  image or PDF), shown in the driver form and file detail.
- **Vehículos:** added **No. de unidad** and **Vencimiento de holograma** fields
  (form, detail, and list). Hologram expiry now feeds the automatic alert generation.
- **Inventario:** added **Marca** and **No. de unidad** to parts.
- **Dashboard:** removed *Viajes hoy* and *Rating promedio* cards (no aplican).
  "Ingresos hoy" relabelled toward rentas (to be wired to the rentas model next).

### Data Model

- `Driver`: removed `medical_cert_expiry`; added `license_file_url`, `ine_file_url`,
  `address_proof_file_url`.
- `Vehicle`: added `unit_number`, `hologram_expiry`.
- `Part`: added `brand`, `unit_number`.

### Version

- `package.json` version `1.0.2` → `1.1.0`.

---

## [1.0.2] — 2026-06-15

### Security

- **[LOW] Fixed Messages page: Channel.list() missing tenant_id filter**: `Channel.list()` had no tenant filter in `Messages.jsx`, inconsistent with the defense-in-depth approach applied to Dashboard (v1.0.1) and Layout (v1.0.0). Changed to `Channel.filter({ tenant_id: tenantId })`. Entity-level RLS was already enforcing isolation, but explicit client-side filtering was absent.
- **[LOW] Fixed Messages page: Message.create() missing tenant_id**: Both text and voice message creation calls lacked an explicit `tenant_id` field. Added `tenant_id: tenantId` to both `Message.create()` calls for defense-in-depth. Entity RLS already scoped writes to the tenant.

### Quality

- **Fixed tenant reload reactivity in Financial, Drivers, Vehicles pages**: `useEffect` hooks in `Financial.jsx`, `Drivers.jsx`, and `Vehicles.jsx` did not list `tenantId` as a dependency, meaning data would not reload if the tenant context changed after initial render. Added `tenantId` to all three dependency arrays.
- ESLint passes with 0 errors.

### Version

- `package.json` version `1.0.1` → `1.0.2`.

---

## [1.0.1] — 2026-06-08

### Security

- **[MEDIUM] Fixed missing tenant filter in Dashboard unread-messages query**: `Message.filter({ read: false })` lacked a `tenant_id` filter. Added `{ read: false, tenant_id: tenantId }` for defense-in-depth tenant isolation (entity-level RLS was already in place).
- **[LOW] Fixed Admin users list exposed all platform users to owner role**: `User.list()` in `Admin.jsx` was called without a tenant scope. For the `admin` role the existing User RLS already restricted to same-tenant users; for the `owner` role it could return all platform users. Changed to `User.filter({ 'data.tenant_id': tenantId })` to scope the Admin page user list to the current tenant regardless of role.

### Quality

- **Updated SDK version in all Deno edge functions**: All five server-side functions (`generateAlerts`, `calculateCostPerKm`, `createTestData`, `githubRepos`, `supabaseData`) were pinned to `npm:@base44/sdk@0.8.25` while the project moved to `^0.8.31`. Updated all imports to `@0.8.31` to align server-side and client-side SDK versions.
- ESLint passes with 0 errors.

### Version

- `package.json` version `1.0.0` → `1.0.1`.

---

## [1.0.0] — 2026-06-02

### Security

- **[HIGH] Fixed cross-tenant document exposure in alert generation** (`generateAlerts` function): `DriverDocument.list()` and `VehicleDocument.list()` previously ran via service-role with no tenant filter, making every tenant's documents accessible to the alert function of any other tenant. Fixed by adding `{ tenant_id: tenantId }` filter to both queries.
- **[HIGH] Added role guard to `calculateCostPerKm` function**: Any authenticated user (including drivers) could previously call the fleet financial analysis endpoint. Now restricted to `owner`, `admin`, and `dispatcher` roles only.
- **[HIGH] Added Row-Level Security (RLS) to User entity**: The User entity had no access controls. Added RLS rules so users can only read others in the same tenant, owners see all, and only admins/owners can update user records.

### Features

- **PermissionsPanel — permissions now persist to backend**: The "Guardar cambios" button was previously cosmetic (permissions reset on every page reload). Permissions are now saved to `TenantLicense.permissions_config` and reloaded when the admin page opens.
- **Admin role locked as non-editable in PermissionsPanel**: Admin always has full access to all modules and is no longer displayed as an editable role tab. Dispatcher, Mechanic, and Driver are the configurable roles.
- **Defense-in-depth tenant filtering in Layout**: Alert and message badge queries now include explicit `tenant_id` filter in addition to the RLS enforcement already in place.

### Quality

- Removed 14 unused imports across Layout, SuperAdminPanel, DriverDetail, Admin, Billing, Drivers, GitHubPage, Import, MaintenancePage, TestData, DriverHome, DriverTrips.
- ESLint now passes with 0 errors.

### Data Model

- Added `permissions_config` (object) field to `TenantLicense` entity for storing per-tenant role permission settings.

### Version

- `package.json` version `0.0.0` → `1.0.0`.

---

## Pre-1.0 — Base44 builder history (summary)

The following modules were built and iteratively improved via the Base44 AI builder prior to formal version tracking:

- **Dashboard**: fleet status, KPI cards, alert/message badges, today's trips and earnings.
- **Drivers**: driver catalog with search, status, rating, photo, detail view, and driver-app linking.
- **Vehicles**: vehicle catalog with plate, make, model, year, odometer, and driver assignment.
- **Maintenance / Parts**: maintenance records, scheduled service, parts inventory.
- **Financial**: fuel logs, fines/infractions, insurance claims, cost-per-km calculation.
- **Alerts**: automatic alert generation for expiring documents, insurance, inspections, maintenance due dates.
- **Messages**: channel-based messaging with real-time updates and voice message support.
- **Location**: on-demand location request/response system (no continuous tracking).
- **Driver App**: driver-specific views for home, trips, and profile.
- **Admin**: tenant management, user invite, role assignment, danger zone, SuperAdmin panel.
- **Billing**: license/plan display, usage metrics, members list.
- **Import**: CSV import utilities.
- **Onboarding**: tenant creation flow for new admins.
- Multi-tenant architecture via `TenantLicense` entity and per-entity RLS rules.
- Role model: `owner`, `admin`, `dispatcher`, `mechanic`, `driver`.
