# Rumbo — Project Notes

Fleet management SaaS (Base44 backend + Vite/React front-end), multi-tenant via
`TenantLicense`. See `docs/permissions_matrix.md` for the role/permission model.

## License self-escalation via `TenantLicense` (module 1, fixed 2026-08-19)

Found by an independent end-to-end re-verification of a prior "10/10 compliant"
audit pass — the re-verification agent didn't just restate this file's claims,
it re-derived module 1 from the actual RLS and found `TenantLicense`'s `update`
rule granted **whole-record** write access to a tenant's own owner (by
`owner_email` match) or any same-tenant owner/admin, with **no field-level
lock** on `status`/`plan`/`max_vehicles`/`max_drivers`/`features`/billing
dates. A tenant's own admin could self-escalate — flip a `suspended`/
`view_only` license back to `active`, or bump their own `plan` to
`enterprise` — via a direct SDK call, contradicting the "written ONLY by
Mission Control's cron" module-1 requirement. This is the exact bug class
`docs/permissions_matrix.md` already fixed repeatedly for *other* entities
(A33/A34/A58 — `tenant_id`, `Driver`, `SupportTicket`), just never applied to
`TenantLicense`'s own billing fields.

**Not hypothetical:** while scoping the fix, found the actual live delivery
mechanism — `SuperAdminPanel.jsx` (rendered on `/admin` for anyone whose OWN
`role` is `owner`, gated only by `isOwner(user.role)` — not by an actual
platform-owner identity check) already had a "Zona exclusiva" panel with a
plan/status editor calling `base44.entities.TenantLicense.update()` directly.
Since every tenant has its own "owner", this UI was reachable by any tenant's
real owner, not just the app's true platform owner — RLS still constrained
the actual write to their own tenant's row (so no cross-tenant leak), but it
gave any tenant owner a working button to edit their own `plan`/`status`.

**Fix:**
- `base44/entities/TenantLicense.jsonc` — `rls:{write:false}` added to
  `plan`, `status`, `max_vehicles`, `max_drivers`, `features`,
  `trial_ends_at`, `current_period_end`, `billing_cycle`, `last_payment_at`,
  `renews_at`. `permissions_config`/`settings`/`members`/`owner_email` stay
  writable by the tenant's own owner/admin — those are genuine tenant-config
  fields (`PermissionsPanel.jsx`, `DangerZone.jsx`'s delegate-ownership flow),
  not license/billing state, and locking them would break real features.
- `base44/functions/licensesAdmin/entry.ts` — new `patch` action (whitelisted
  to a `PATCHABLE_FIELDS` set), alongside the existing `list`/`renew`/
  `set_status`. Still gated by `APP_OWNER_EMAIL` + `asServiceRole`, same as
  before.
- `src/components/admin/SuperAdminPanel.jsx` — migrated both `list` and the
  plan/status/limits editor from direct `base44.entities.TenantLicense.*`
  calls to `licensesAdmin` invocations. Closes the `isOwner()` UI-gating gap
  too: a regular tenant owner clicking into this panel now gets a real 403
  from the server-side `APP_OWNER_EMAIL` check instead of a silently-scoped
  RLS read/write on just their own tenant.
- `src/components/admin/TenantEditor.jsx` — its no-license-yet create
  fallback no longer explicitly sends `plan: 'trial', status: 'active'`
  (now `rls.write:false` fields); the entity's own JSON-Schema `default`
  already supplies the same values on create, so behavior is unchanged.
- `createTenant/entry.ts`'s service-role create (the real onboarding path)
  and `licensesAdmin`'s `renew`/`set_status`/`patch` actions are unaffected —
  `asServiceRole` bypasses field-level RLS the same way it bypasses
  entity-level RLS.

**Verified:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm run
validate:rls` (27 entities OK), `npm run test` (463/463) all pass.
**Deploy confirmed live** (2026-08-19, via the Base44 MCP's
`list_entity_schemas` against `appId 6a15eceffe8dbf6602fa6c35`): the running
`TenantLicense` schema already carries `rls.write:false` on all ten fields
and `licensesAdmin`'s new `patch` action is present in the deployed function
source — this repo's `main` branch syncs to the live Base44 backend
automatically (confirmed independently by `base44-builder[bot]` pushing a
reverse-sync commit to `main` the same day). A live browser session as a
non-owner tenant admin attempting the old `SuperAdminPanel`/direct-write
path still wasn't achievable here.

## In-app changelog digest (module 6, added 2026-08-19)

`CHANGELOG.md` at the repo root was kept current release-over-release, but
nothing in the running app ever showed it — `Help.jsx`'s version stamp
(`APP_VERSION`/`RELEASE_DATE` from `src/lib/version.js`) had no changelog
next to it. Added a `CHANGES` array to `Help.jsx` — plain-language Spanish
summaries of recent releases (not the raw technical `CHANGELOG.md` entries),
rendered as a new "Historial de cambios" section above the version stamp,
matching the pattern already used in stockflow/cateqhub/puntos/radar/liuma.
Bumped to v1.31.0 alongside the module 3 fix below (same release).

**Verified:** `npm run lint`, `npm run build`, `npm run typecheck` all pass —
purely additive, no RLS or permission change.

## Account & danger zone — added data export (module 7, 2026-08-18)

A portfolio-standard audit (`jospabloh/acacia-app-standard`, module 7) found
`DangerZone.jsx` (`src/components/admin/DangerZone.jsx`, rendered from
`Admin.jsx` for `owner`/`admin`) already had delegate-ownership and
delete-tenant flows, but no way to download the tenant's data first. New
`exportTenantData` function (service role, but every read explicitly filtered
by the caller's own `tenant_id` — never cross-tenant) returns every row
across the 14 operational entities (`Vehicle`, `Driver`, `Trip`,
`Maintenance`, `Part`, `FuelLog`, `Fine`, `InsuranceClaim`, `Alert`,
`Expense`, `RentCharge`, `VehicleDocument`, `UnitDayNote`,
`DashboardUnitPref`, `DriverDocument`) as one JSON payload; `DangerZone.jsx`
turns the response into a client-side download, placed above delegate/delete
("hazlo antes de eliminar").

**Verified:** `npm run lint`, `npm run build`, `npm run validate:rls`
(27 entities OK), `npm run test` (463/463) all pass.

## Module 3 (granular server-side permission enforcement, "G1") — fixed 2026-08-19

Previously deferred as "a multi-entity, multi-file initiative on the scale
of a dedicated pass" — now done. `docs/permissions_matrix.md`'s own "G1"
note ("These granular permissions currently control the UI only... does
not yet read permissions_config") is resolved.

**The gap:** entity RLS enforces the *role*-level access (owner/admin/
dispatcher/mechanic, `role:dispatcher` etc. in each entity's `$or`), but has
no way to see a tenant admin's own override in
`TenantLicense.permissions_config` (set via the Permisos por Rol panel). A
dispatcher an admin explicitly denied "Rentas:create" could still create a
`RentCharge` via a direct SDK call — RLS never narrows past the role check.

**Fix:** `base44/functions/guardedEntityWrite` — one parameterized Safe
function, now the sanctioned write path for all 17 module-scoped
operational entities (Vehicle, VehicleDocument, Driver, DriverDocument,
DriverPrivateNote, Trip, Maintenance, Part, FuelLog, Fine, InsuranceClaim,
Alert, Message, Channel, LocationRequest, Expense, RentCharge,
UnitDayNote). It:
1. Derives role and `tenant_id` from the caller's own profile (`user.role`,
   `user.data.tenant_id` — both server-authoritative, written only by
   `resolveTenant`), never from the request.
2. Checks `TenantLicense.permissions_config` via `moduleCan()` — an inline
   copy of `src/lib/modulePerms.js`'s `DEFAULT_PERMISSIONS`/`moduleCan`
   (Deno functions can't import from `src/`, so this is duplicated by hand;
   keep both in sync if the defaults change).
3. Re-derives every driver "own record" exception that exists in RLS
   independently of the configurable matrix — a driver's own `Trip`, their
   own `Driver.profile_id`, confirming their own pending
   `LocationRequest` — since `asServiceRole` bypasses per-record RLS and
   would otherwise let a driver touch *any* tenant record of that type.
4. Enforces `Message.create`'s unconditional `sender_id == caller` rule
   (the entity's RLS has no role branch at all for this op, not even for
   owner/admin) and re-checks it server-side rather than trusting the
   client-submitted value.

**Two entities needed a narrower gate than their nominal module implies**
(`ROLE_ONLY_ENTITIES` in `entry.ts`, bypassing `moduleCan` entirely):
- `Channel` shares the `messages` module with `Message` for
  permission-config purposes (drivers can send messages, so
  `messages:create` defaults true for them), but `Channel.jsonc`'s own RLS
  never allowed driver/mechanic to create a *channel* — only owner/admin/
  dispatcher. Applying the generic `messages` check would have wrongly
  granted drivers channel-creation.
- `LocationRequest` (module `location`) has **no `useModulePerms().can()`
  gate anywhere in the current UI** (confirmed by grep across
  `src/pages`/`src/components`) — `Location.jsx`'s "solicitar ubicación"
  button is unconditionally visible to any dispatcher who reaches the
  page. `DEFAULT_PERMISSIONS.dispatcher.location.create` is `false` by
  documented default; enforcing that for the first time here would have
  silently broken a live feature no tenant admin has ever had reason to
  configure. Treated instead as role-gated only (owner/admin/dispatcher,
  matching `LocationRequest.jsonc`'s own RLS exactly), plus the driver
  self-confirm exception above — same principle as `jospabloh/liuma`'s
  investigated-and-excluded `AppSession` finding: don't newly enforce a
  documented-but-never-wired restriction as a side effect of an unrelated
  fix.

**New `src/lib/guardedWrite.js`** — thin client wrapper
(`guardedCreate`/`guardedUpdate`/`guardedDelete`). Note this app's
`base44.functions.invoke()` returns `{ data: <body> }`, not the body
directly (different from some other apps in this portfolio) — the wrapper
unwraps that and throws on a non-`ok` body. Migrated 48 real call sites
across 20 files — near-mechanical, since the wrapper matches the entity
SDK's calling shape (data in, record out).

**Verification performed:** `npm run lint`, `npm run build`, `npm run
validate:rls` (27 entities, unaffected — no `.jsonc` file changed), `npm
test` (463/463) all pass. `deno` isn't available in this sandbox — but
**deploy confirmed live** (2026-08-19, via the Base44 MCP): `entry.ts`'s
`ROLE_ONLY_ENTITIES`, `DRIVER_SELF_SCOPE`, and `moduleCan()` are all present
in the running function source at `appId 6a15eceffe8dbf6602fa6c35`, matching
the repo exactly — this repo's `main` branch syncs to the live Base44
backend automatically. **Not verified:** an actual browser session as a
permission-restricted dispatcher/mechanic/driver — not achievable in this
environment. Risk is bounded the same way as every other module-3 fix in
this portfolio: every migrated call site preserves identical behavior for
anyone whose role/config combination already
granted access (verified case-by-case against each entity's own deployed
RLS and against which pages actually gate their buttons with
`useModulePerms().can()` today) — the only behavior change is that a user
an admin explicitly denied a specific module action now correctly fails
server-side instead of the write silently succeeding.

## Deploy: el id de la app vive en el repo (módulo 11, 2026-08-21)

El 2026-08-21, un `git pull` fallido dejó la terminal parada en `flowfin` y los
seis comandos siguientes desplegaron **el backend de FlowFin** en puntos, radar,
stockflow y ctrlhq: la CLI toma el origen del **directorio actual** y el destino
de `--app-id`, y nada comprueba que coincidan. En radar el `entities push` llegó
a completarse y borró el modelo de datos entero. Detalle en
`jospabloh/acacia-app-standard` → `docs/incidents.md`.

Por eso este repo ya no se deploya a mano:

```bash
npm run deploy            # funciones — lee el appId de base44.app.json
npm run deploy:site       # frontend — mergear a main NO lo hace por ti
npm run deploy:entities   # schema — DESTRUCTIVO, pide escribir "Rumbo"
npm run functions:audit   # quién llama a cada endpoint
```

**Mergear a `main` no deploya el sitio.** Se creyó lo contrario durante meses.
En flowfin se comprobó al revés: un fix se mergeó a `main` y, horas después, el
árbol que el app realmente servía seguía siendo el de antes del fix — mergear no
propaga nada (detalle en el CLAUDE.md de flowfin). El
frontend se deploya a mano con `npm run deploy:site`, igual que las funciones.
Y comprueba el resultado por **contenido**, no por hashes: el checkpoint del app
puede reportar un `git_commit_hash` igual al HEAD de `main` mientras el árbol que
de verdad se sirve está atrasado.

`scripts/base44-deploy.mjs` **rechaza** un `--app-id` por argumento, así que el
directorio y la app destino no pueden desalinearse. `deploy:entities` imprime la
lista de entidades y el nombre de la app antes de pedir confirmación — ver
"36 entidades de FlowFin" mientras crees estar desplegando otra app es la señal
de alto que faltaba.

`npm run validate:functions` (dentro de `npm run lint`) falla si los endpoints
pasan de `maxFunctions` en `base44.app.json` — hoy **40**, con
Base44 cortando en 50. El margen importa: por encima del tope el deploy falla a
media aplicación y la CLI **no** llega a su fase de poda, así que las funciones
viejas siguen ocupando los slots que harían falta para arreglarlo.

**Antes de consolidar o borrar cualquier función, corre `npm run functions:audit`.**
Una función sin llamadores en el repo casi nunca está muerta: el llamador vive
fuera, donde grep no ve — un entity hook de Base44, un cron del panel, un
`tool_config` de un agente, la URL de un webhook. El audit marca esas como
`REVISAR EN PANEL` en vez de adivinar; confírmalas contra
`npx base44 functions list` (anota `(N automation)`) antes de tocarlas.

## Selector de tema: claro / oscuro / dispositivo (módulo 12, 2026-08-21)

El tema se elige desde **un solo control**: un círculo pequeño anclado a una
esquina de la pantalla que muestra el modo vigente y, al pulsarlo, crece de lado
en una pista de tres ranuras (Claro · Oscuro · Sistema) con un indicador que se
desliza a la elegida. Tres estados, tres posiciones físicas — que es justo lo
que un botón sol/luna de dos estados no puede expresar en cuanto "seguir al
dispositivo" entra en la lista.

Lo que se guarda es la **preferencia** (`light` | `dark` | `system`), nunca el
color resuelto: con `system` la app sigue a `prefers-color-scheme` en vivo, sin
recargar. `index.html` trae un script pre-montaje que resuelve y aplica el tema
antes de que monte React, así que el primer frame ya sale del color correcto;
ese script y el proveedor comparten clave y valores, y cada uno lleva un
comentario apuntando al otro.

`src/components/ThemeSwitcher.jsx` es **idéntico byte a byte en todas las apps
del portafolio**. La fuente canónica vive en `jospabloh/acacia-app-standard` →
`shared/theme/`: cámbialo allí y cópialo, no lo edites aquí. Lo único propio de
esta app es `src/lib/useThemeMode.js` (de dónde sale el estado) y las variables
`--theme-switcher-bottom/right` en `src/index.css` (dónde se coloca).

Se quitó el toggle del pie de la barra lateral. `ThemeProvider` pasó de
`enableSystem={false}` a `enableSystem` (el default sigue siendo `dark`), y la
paleta de comandos ahora ofrece los tres modos como tres comandos en vez de un
único "cambiar tema".

## `npm run test:smoke` — comprueba el sitio DESPLEGADO (2026-08-22)

`tests/smoke/smoke.spec.js` es la suite compartida del portafolio, idéntica byte
a byte en todos los repos; la fuente canónica está en
`jospabloh/acacia-app-standard` → `shared/smoke/`. Lo propio de esta app vive en
`tests/smoke/smoke.config.js` (URL, `<title>`, cómo representa el tema).

**No comprueba el build local: comprueba lo que se sirve.** Es la automatización
de la regla que cada CLAUDE.md repite — mergear no deploya nada, y hay que
verificar por contenido y no por hash. Afirma cuatro cosas, todas derivadas de
lo que el propio repo produce (nunca de copy adivinado, que se rompe al cambiar
una palabra y enseña a ignorar la suite):

1. responde 200 y el `<title>` es el de esta app — no un deploy viejo ni otro;
2. no lanza excepciones al pintar;
3. el tema llega resuelto desde el primer frame (el script pre-montaje viajó);
4. el selector de esquina está montado, cambia el tema y la preferencia
   sobrevive a un reload.

**No corre en el pipeline normal ni desde un sandbox de desarrollo**: la salida
HTTPS ahí va por un proxy con allowlist que no incluye estos dominios. Corre en
GitHub Actions (`.github/workflows/smoke.yml`): `workflow_dispatch` para
dispararla a mano justo después de un deploy, y un cron diario como red.

    npm run test:smoke                      # contra producción
    SMOKE_URL=https://… npm run test:smoke  # contra un preview

Desde el 2026-08-22 la suite añade una quinta afirmación, del **módulo 12**: el
selector no tapa nada y nada lo tapa, en móvil (390), tablet (834) y escritorio
(1440), plegado y desplegado. Un control anclado por encima de todo en una
esquina es justo lo que acaba sentado sobre una barra inferior o un botón
flotante, y entonces la app pierde una función al ancho que nadie abrió. La
comprobación distingue las dos direcciones — algo pintado encima del selector, y
el selector respondiendo por un control que hay debajo — y nombra el control
afectado. Se coloca con `--theme-switcher-bottom/right`; si otra cosa ya es dueña
de esa esquina, se mueve el selector, no el control.

## Módulo 14 — auditoría de aislamiento multi-tenant (2026-08-22)

Nuevo en `jospabloh/acacia-app-standard`. **No es releer las reglas de RLS** (eso
es el módulo 4): es recorrer, con fecha y por escrito, todo lo que puede cruzar
un inquilino con otro — cada entidad, cada función de backend (el inquilino se
re-deriva en el servidor, nunca del cuerpo de la petición, y en update/delete se
comprueba contra el registro **almacenado**), cada campo bloqueado, cada
exportación/reporte/búsqueda, cada destinatario de correo o webhook, y el cambio
de inquilino. Contra el **esquema desplegado**, no contra el archivo del repo.

Se repite cuando se añade una entidad, una función o un rol. El resultado se
anota aquí, incluyendo **lo que no se pudo verificar** desde el entorno de
trabajo — normalmente una sesión autenticada como usuario restringido de un
segundo inquilino. Decirlo vale más que insinuar una cobertura que no se logró.

Lo que motiva el módulo es que todos los fallos de aislamiento que este
portafolio llegó a desplegar eran **sintácticamente válidos**: la rama de rol sin
`$and` al inquilino en `Parish` de cateqhub, las 84 instancias de liuma donde el
motor descartaba la cláusula hermana de `user_condition`, los campos de licencia
escribibles por el propio inquilino en puntos y rumbo, y el `PermissionProfile`
que ningún RLS puede consultar porque vive en otra fila.

## Módulo 14 — auditoría de aislamiento multi-tenant

### Resultado — 2026-08-23, contra el esquema desplegado

**No se encontró ningún cruce entre inquilinos.** Un hallazgo real dentro del
inquilino, abajo.

**Las 16 funciones derivan el inquilino del servidor.** Ninguna lo toma del
cuerpo de la petición — comprobado por grep sobre las 16, no por muestreo.

`guardedEntityWrite` cubre las dos mitades que el módulo pide, y una tercera que
no pide pero importa:

- **create** fuerza `tenant_id: tenantId` **después** de esparcir `body.data`,
  así que lo que mande el cliente no puede ganar;
- **update/delete** re-leen el registro y comparan
  `existing.tenant_id !== tenantId` → 404;
- **update borra `tenant_id` del patch**, para que un registro existente no se
  mueva de inquilino, y en `Message` borra también `sender_id`, para que un
  mensaje ya enviado no se pueda re-atribuir a otra persona;
- el camino de auto-alcance del conductor (`DRIVER_SELF_SCOPE`) se comprueba
  contra el registro **almacenado**, incluido `requireStatus` — no contra lo que
  venga en la petición.

**Tres funciones de plataforma fallan CERRADO**, y eso merece nombrarse:
`githubRepos`, `supabaseData` y `licensesAdmin` responden 403 si
`APP_OWNER_EMAIL` no está configurado, en vez de abrirse. Es exactamente la
lección contraria a la que flowfin aprendió por las malas con su
`_internalGuard.ts`, y aquí está bien.

**Los 10 candados de licencia del 2026-08-19 siguen desplegados** — releídos del
esquema vivo: `plan`, `status`, `max_vehicles`, `max_drivers`, `features`,
`trial_ends_at`, `current_period_end`, `billing_cycle`, `last_payment_at` y
`renews_at` llevan `rls.write: false`.

### Hallazgo: un `admin` puede hacerse `owner` y borrar el inquilino

No cruza inquilinos, pero anula una puerta que el propio RLS quiso poner.

`TenantLicense.delete` se llave a **una sola cosa**:
`{"data.owner_email": "{{user.email}}"}`. La intención es clara: sólo el dueño
borra. Pero:

- `owner_email` **no** tiene candado de campo — a diferencia de los 10 de
  licencia;
- `TenantLicense.update` permite escribir el resto del registro a cualquier
  `owner` **o `admin`** que sea miembro del propio inquilino;
- `Admin.jsx:185` renderiza `DangerZone` bajo `isAdminOrOwner(user?.role)`, y
  `DangerZone.jsx:55` escribe `owner_email` directamente.

Así que un `admin` puede delegarse la propiedad a sí mismo **desde la interfaz**,
sin tocar el SDK, y a partir de ahí cumple la condición de `delete`. La puerta
"sólo el owner borra" no cierra nada mientras un admin pueda convertirse en
owner en un clic.

Dos formas de arreglarlo, según lo que se quiera: si delegar propiedad es cosa
del dueño, bloquear `owner_email` a `owner` (o a rol de servicio, vía
`licensesAdmin`) y gatear `DangerZone` en `isOwner`; si un admin sí debe poder
delegar, entonces `delete` no debería depender de `owner_email` sino de una
confirmación escrita como la que usan otras apps del portafolio.

### No verificado

Una sesión autenticada como `admin`, `dispatcher`, `mechanic` o `driver` de un
segundo inquilino. Lo de arriba es lectura de código y del esquema desplegado:
suficiente para descartar los defectos estructurales de aislamiento, y para
afirmar el hallazgo de arriba leyendo las tres piezas que lo componen, pero no
para decir que el motor evalúa cada regla como se lee.

### Hallazgo cerrado — 2026-08-24

De las dos formas que el hallazgo de arriba proponía, se tomó la primera:
delegar propiedad es cosa del dueño, así que `owner_email` se bloqueó y
`DangerZone` se gateó a `isOwner`.

- `base44/entities/TenantLicense.jsonc` — `owner_email` ahora `rls.write:
  false`, mismo mecanismo que los diez campos de licencia del módulo 1. Ya
  nadie puede escribirlo por SDK directo, ni el propio owner.
- Nueva `base44/functions/delegateOwnership` (service role) — el único
  camino tenant-scoped que queda para reasignarlo. Relee el registro
  **almacenado** y exige que el caller sea ya su `owner_email` antes de
  escribir uno nuevo; el destino debe ser ya miembro del mismo tenant. No
  gatea por `user.role` del perfil — ese es justo el campo que el hallazgo
  demostró que un admin también alcanza.
  `licensesAdmin`'s `patch` sigue siendo el otro escritor de `owner_email`,
  sin cambios — ese ya estaba gateado a `APP_OWNER_EMAIL` (el owner de la
  plataforma), no al owner del tenant.
- `src/components/admin/DangerZone.jsx` — recibe un prop `isOwner`; delegar
  y eliminar solo se renderizan si es `true` (un admin ve una línea
  explicativa en su lugar). `handleDelegate` pasó de
  `base44.entities.TenantLicense.update()` a invocar `delegateOwnership`.
  Exportar datos se queda disponible para admin también — no es una acción
  de riesgo, no hacía falta tocarla.
- `src/pages/Admin.jsx` — pasa `isOwner={isOwner(user?.role)}` a
  `DangerZone` (el import ya existía en este archivo).
- `docs/permissions_matrix.md` — las dos filas de la tabla de acciones y la
  fila de `TenantLicense` en el resumen de RLS, más una nota⁶.

**Verificado:** `npm run lint` (incluye `validate:functions` — 17
endpoints, techo 40), `npm run build`, `npm run typecheck`, `npm run
validate:rls` (27 entidades OK), `npm test` (463/463) — todos limpios.
`deno check` sí corrió en este sandbox contra la función nueva (siguiendo la
nota del módulo 15 de abajo: el binario se baja de GitHub releases y sí pasa
por el proxy) — compila limpio contra los tipos reales de `@base44/sdk`.

**No verificado:** el deploy en vivo (esta vez no se confirmó contra el
esquema desplegado vía Base44 MCP, a diferencia del módulo 1 — pendiente de
que este PR se mergee y el sync automático de `main` lo suba) ni una sesión
de navegador autenticada como admin de un tenant intentando el flujo viejo.
El riesgo está acotado: el cambio es un candado de campo más una función de
servicio, mismo patrón ya probado en producción para los diez campos de
licencia del módulo 1.

## Módulo 15 — el puente con Mission Control: una llave por app (2026-08-23)

`INGEST_HMAC_SECRET` es **un solo valor compartido por todo el portafolio**, así
que una firma hecha con él demuestra «alguien tiene el secreto compartido» y
nunca «esto es Rumbo». Como el nombre de la app viaja en el cuerpo, cualquier
app podía firmar una carga diciendo ser otra y Mission Control la escribía con
esa atribución. Lo encontró la auditoría del módulo 14 de Mission Control.

El arreglo es dejar de usar el maestro directamente:

    appKey = HMAC-SHA256(maestro, "acacia.app.v1." + slug)

El prefijo es separación de dominio: garantiza que una llave derivada no puede
coincidir con una firma sobre un cuerpo, y el `v1` permite rotar el esquema sin
rotar el maestro.

`base44/functions/{acaciaControl,submitTicket}/_acaciaSign.ts`
es **idéntico byte a byte en todas las apps del portafolio**. La fuente
canónica vive en `jospabloh/acacia-app-standard` →
`shared/bridge/acaciaSign.ts`: cámbialo allí y cópialo, no lo edites aquí.
Dos copias idénticas: `acaciaControl` **verifica** y `submitTicket` **firma** el
ticket que sale hacia Mission Control.

**La migración tiene un orden y es el contrario del obvio.** La verificación
acepta las dos llaves mientras `ACCEPT_LEGACY_MASTER` sea `true`, así que da
igual quién despliegue primero. Pero Mission Control despliega al mergear y las
apps a mano, así que MC siempre va primero — por eso MC sigue **firmando** con
el maestro hasta que las nueve apps acepten derivada. **Los dos pasos ya están hechos** (2026-08-24): MC firma con `signFor` y
`ACCEPT_LEGACY_MASTER` está en `false` en los once sitios, así que una firma con
el maestro **ya no se acepta** — que es exactamente lo que cierra el agujero. `ACACIA_APP_SLUG=rumbo` está puesto **y verificado** — ver abajo, porque
el valor que traía antes no era éste.

**Corrección del 2026-08-24: ese «ya estaba puesto» nunca se comprobó, y era
falso.** En la primera sincronización de las nueve apps de ese día, Mission
Control registró que **rumbo rechazó la llave derivada y aceptó el maestro** —
junto con las otras tres que tampoco pasaron. Las cuatro son justo las que
traían el secreto de antes, de cuando se cableó el push de tickets; las cinco a
las que se les puso ese día verificaron derivada a la primera. O sea: aquí había
un `ACACIA_APP_SLUG`, pero con un valor que no producía la llave que MC calcula.

**No era un `acaciaControl` viejo**, que era la otra hipótesis: al redesplegar,
la CLI reportó `acaciaControl unchanged`, así que el código vivo ya traía
`_acaciaSign.ts` desde antes de esa sincronización. La única variable que
quedaba era el valor del secreto.

Corregido el mismo día. La sincronización de las 16:29 UTC dio nueve filas de
auditoría y **cero** advertencias `rejected the derived key`, y con esa medición
—no con una fecha— se apagó el flag en los once sitios y se borró el respaldo de
Mission Control.

Lo que hay que quedarse: **un secreto que nadie ha releído no está configurado.**
Este archivo afirmó por escrito durante días que lo estaba. El módulo 16 del
estándar existe por esto.

**Y ahora hay una prueba, que es lo que faltaba.** El helper no lo comprobaba
nada: cada PR de este módulo decía que recibía su primer type-check al
desplegar. `acaciaSign.test.ts` (canónico en el repo estándar) fija el vector
que la mitad Node de Mission Control ya fijaba —dos implementaciones de HMAC en
dos runtimes sólo siguen siendo iguales si algo lo afirma, y una divergencia se
ve en runtime como `bad signature` en cada llamada, que parece un secreto mal
puesto y no lo es— y afirma lo que este módulo promete: un cuerpo firmado por
una app que dice ser otra **no** verifica. No tiene imports externos ni toca la
red, así que corre en un sandbox donde `jsr.io` y `deno.land` están bloqueados.
El test canónico está en el repo estándar; este repo no tiene paso de deno en CI.

**La criptografía en línea que esto reemplaza ya no está.** Cada `acaciaControl`
llevaba su propio `stableStringify` / `hmacHex` / `timingSafeEqual`, copiados a
mano contra `api/_lib/ingestSign.js` de Mission Control. Dejarlos al lado del
helper no es desorden: es una segunda implementación de la misma rutina en el
mismo archivo, que es exactamente la deriva que este módulo quita.

### `deno` SÍ se puede correr aquí — este archivo decía lo contrario

Este CLAUDE.md repetía «deno no está disponible en este sandbox» y por eso
varios cambios de `base44/functions/` se dieron por no verificables y se
mandaron a que CI los mirara por primera vez. **Es falso.** El binario se baja
de la release de GitHub —el mismo sitio de donde lo saca `setup-deno` en el
runner— y GitHub sí pasa por el proxy:

    curl -sSL -o deno.zip https://github.com/denoland/deno/releases/download/v2.9.5/deno-x86_64-unknown-linux-gnu.zip
    unzip -q deno.zip && chmod +x deno && ./deno --version

Lo que de verdad está bloqueado es `deno.land` y `jsr.io`, así que un test que
importe de ahí no resuelve; uno que no importe nada corre igual que en CI. Es la
misma lección que el `000` del proxy en Mission Control: **que una vía esté
bloqueada no significa que la pregunta no tenga respuesta.**

## Módulo 18 — selector de organización: un email, varios tenants (2026-08-24)

Nuevo en `jospabloh/acacia-app-standard` → `STANDARD.md`. El disparador fue
operativo, no un hallazgo de auditoría: el email dueño de esta instancia
(`h.josepablo@gmail.com`) resultó ser `owner_email` de dos `TenantLicense` a la
vez ("Car-Go Rent" y "Owner") mientras se cargaban datos reales de flotilla, y
`resolveTenant` solo sabía resolver **uno**.

**Lo que había:** `resolveTenant` recorría
`created_by_id → owner_email → members[]` y devolvía el primer match; una vez
persistido en el perfil (`tenant_id`, `write:false`), ese binding era
permanente. `joinTenant` además rechazaba explícitamente unirse a un segundo
tenant por código ("ya perteneces a otra organización"). Un email que
legítimamente administra dos organizaciones quedaba encerrado en la que
`resolveTenant` viera primero, sin error, sin aviso y sin salida — el segundo
tenant no estaba mal resuelto, era invisible.

**Fix (dos funciones de servidor + un control de cliente, sin tocar el modelo
de tenant):**

- `base44/functions/resolveTenant/entry.ts` — ahora calcula el conjunto
  **completo** de tenants candidatos (mismo criterio de siempre: creador,
  `owner_email` o miembro), no solo el primero. Con `tenant_id` ya persistido
  y válido, el comportamiento no cambia — pero la respuesta ahora siempre
  lleva `candidates` (id, nombre, logo) para que el cliente pueda ofrecer un
  selector persistente. Sin nada persistido: un solo candidato se autoasigna
  igual que antes; más de uno **no se adivina** — se devuelve
  `needs_tenant_choice: true` en vez de onboarding o una asignación silenciosa.
- Nueva `base44/functions/switchTenant/entry.ts` (service role) — el único
  camino para mover `tenant_id` de un candidato a otro. Recalcula el conjunto
  de candidatos legítimos del caller **desde cero**, igual que `resolveTenant`
  — nunca confía en que el `tenant_id` que mandó el cliente sea uno de los
  suyos. Un id fuera de ese conjunto responde exactamente igual que uno
  inexistente (404 genérico — el endpoint no debe funcionar como oráculo de
  existencia, módulo 14 §6 del estándar). El rol se re-deriva igual que en el
  primer enganche (`owner_email` → owner; miembro con rol propio → ese rol;
  creador → conserva el rol del perfil); `suspended` no se toca, para no
  limpiar ni imponer un bloqueo que pertenece al tenant activo, no al switch.
- `src/lib/TenantContext.jsx` — expone `candidates`, `needsTenantChoice` y
  `switchTenant()`; este último invoca la función y **recarga la página
  entera** al terminar en vez de intentar resetear cada hook/lista/caché
  tenant-scoped en el lugar (es el único reset que no puede dejar nada del
  tenant anterior vivo en un closure).
- Nuevo `src/components/TenantPicker.jsx` — pantalla completa, mismo layout
  que `Onboarding.jsx`; `App.jsx`'s `TenantGate` lo monta en vez del
  onboarding cuando `needsTenantChoice` es verdadero (revisado **antes** que
  `needsOnboarding`, porque ambos ven `tenantId` nulo).
- Nuevo `src/components/TenantSwitcher.jsx` — control compacto en el pie del
  logo/nombre del tenant en `Layout.jsx`; solo se monta si
  `candidates.length > 1`, así que un operador con una sola organización
  nunca ve un control sin nada que hacer.
- `docs/permissions_matrix.md` — filas de `resolveTenant`/`switchTenant`
  actualizadas en la tabla de funciones de backend.

**Lo que NO cambió a propósito:** `joinTenant` sigue rechazando unirse a un
segundo tenant *por código* mientras ya se pertenece a uno — es una red de
seguridad distinta (evitar un código mal tecleado) y relajarla es una decisión
de producto aparte, no parte de este módulo. El selector resuelve la
ambigüedad para memberships que **ya existen** (como creador, `owner_email` o
invitación previa a `members[]`), no abre una vía nueva para adquirir una.

**Verificado:** `npm run lint` (incluye `validate:functions` — 18 endpoints,
techo 40), `npm run build`, `npm run typecheck`, `npm run validate:rls` (27
entidades OK, sin cambios de esquema), `npm test` (463/463) — todos limpios.
`deno check` corrió contra `switchTenant/entry.ts` en este sandbox (mismo
método del módulo 15/16: el binario se baja de GitHub releases) y compila
limpio contra los tipos reales de `@base44/sdk`; de paso quedó documentado que
`resolveTenant`/`joinTenant`/`manageMember` ya tenían un `error.message` sin
`as Error` que `deno check` sí marca (pre-existente, no de este cambio — este
repo no corre `deno check` en CI, así que nunca se había visto) —
`switchTenant` se escribió con el cast, siguiendo el patrón más nuevo de
`delegateOwnership`.

**No verificado:** el deploy en vivo (pendiente de que este PR se mergee y el
sync automático de `main` lo suba) ni una sesión de navegador real con un
email que pertenezca a dos tenants — el caso real que lo disparó
(`h.josepablo@gmail.com`) solo se confirmó por lectura directa de
`TenantLicense` vía el MCP de Base44, no logueando con esa sesión en el
navegador desde este entorno.

## Login con Apple retirado; errores reales de guardedWrite ya no se ocultan (2026-08-26)

Feedback real de dos usuarios intentando entrar al tenant **Car-Go Rent**
destapó tres problemas sin relación entre sí. Los dos de código se arreglan
aquí; el tercero era un dato de licencia, corregido directo en el tenant
(abajo).

**1. "Continuar con Apple" nunca funcionó.** Sign in with Apple no estaba
habilitado en el backend de Base44 de esta app — el botón lanzaba el error
crudo de la plataforma (`Apple authentication is not enabled for this
app...`) antes de que existiera ninguna cuenta. Confirmado contra los
usuarios reales de la app vía el MCP de Base44: no había ninguna cuenta a
nombre de la persona que lo intentó — no había nada que notar hasta que lo
reportó a mano. `src/components/auth/parts.jsx`'s `SocialButtons` ahora solo
ofrece Google; se borró el `AppleIcon.jsx` que quedó sin uso. Generalizado en
`jospabloh/acacia-app-standard` → Módulo 10: ningún botón de login social se
muestra si su proveedor no está realmente habilitado.

**2. `guardedWrite.js` nunca pudo mostrar el error real de una escritura
fallida.** Confirmado leyendo el propio SDK (`node_modules/@base44/sdk`):
el cliente de funciones se crea con `interceptResponses: false`, así que
`base44.functions.invoke()` es axios puro — sin el interceptor que en el
resto del SDK unenvuelve la respuesta y normaliza el error. Cualquier
respuesta no-2xx de `guardedEntityWrite` (permiso denegado, licencia
bloqueada, no encontrado — cualquiera de los `bad()` en `entry.ts`) hacía
que la promesa se **rechazara** con el mensaje genérico de axios
(`"Request failed with status code N"`), y el cuerpo real
(`{ok:false, code, error}`) quedaba sin leer en `err.response.data`. Por
eso un owner editando su propio vehículo solo veía "Request failed with
status code 400" sin ninguna pista de la causa real. `invokeGuarded()` ahora
también lee `err.response.data` en el catch — cubre los 48 puntos de llamada
sin tocarlos, porque el fix vive solo en el wrapper. Nuevo
`src/lib/__tests__/guardedWrite.test.js` fija el comportamiento en los dos
casos (2xx con `ok:false`, y el rechazo de promesa que antes se escapaba sin
parsear).

**3. Dato de licencia corregido (no es código).** El mismo tenant (Car-Go
Rent, plan `starter`) tenía `max_vehicles: 5` puesto a mano — por debajo del
default de su propio plan (15) — mientras ya tenía 7 vehículos activos, así
que cualquier alta nueva se bloqueaba correctamente contra ese tope
incoherente. Se quitó el override vía el MCP de Base44
(`$unset: {max_vehicles: ""}` sobre el `TenantLicense` id
`6a4c67c5131100e9f96e1e51`) para que aplique el default real de `starter`
(15). Sin PR ni deploy — es un dato, no código.

**Verificado:** `npm run lint` (18 endpoints, sin cambio — este fix no toca
`base44/functions/`), `npm run build`, `npm run typecheck`, `npm run test`
(467/467, cuatro nuevos en `guardedWrite.test.js`) todos limpios. Sin cambio
de RLS ni de esquema — `npm run validate:rls` no aplica. La corrección de
dato en Car-Go Rent se verificó leyendo el registro de vuelta vía el MCP de
Base44 (`max_vehicles` ausente del registro). **No verificado:** una sesión
de navegador real completando el flujo de "Unirme a una organización" con el
código de Car-Go Rent (`RUMBO-PB2JNH`) — no alcanzable desde este entorno;
ese flujo ya existía sin cambios (`src/pages/Onboarding.jsx`'s `JoinTenant`).

## Invitar por correo llamaba al invite de la PLATAFORMA de Base44, no al de la app (2026-08-26)

Al preparar la invitación real de un segundo usuario a Car-Go Rent se
encontró un hallazgo más serio que un bug de UI. `InviteForm.jsx`
("Administración → Invitar usuario") llamaba
`base44.users.inviteUser(email, role)` — **no** `base44.auth.inviteUser`.
Son dos módulos distintos del SDK contra dos endpoints distintos:

- `base44.users.inviteUser` → `POST /apps/{id}/runtime/users/invite-user`,
  con `role` restringido en el propio SDK a `'user' | 'admin'` (lanza
  excepción con cualquier otro valor). Es el invite de **la plataforma/
  builder de Base44** — invitar a alguien como colaborador de la app en el
  estudio de Base44. Pasar `'admin'` aquí da **acceso de co-admin para
  editar el schema, las funciones y los deploys de la app entera** — nada
  que ver con el modelo de roles de este tenant.
- `base44.auth.inviteUser` → `POST /apps/{id}/users/invite-user`, sin
  restricción de rol. Es el pensado para dar de alta a un usuario final de
  la app; el rol real dentro de la app ya sale de `members[]` (la misma
  escritura que hace `joinTenant`/`resolveTenant` con el código de unión).

El `<Select>` del formulario ofrece 6 roles (todos menos Owner); solo 2
(`admin`, `user`) pasan la validación del que SÍ se llamaba. Los otros 4 —
Dispatcher, Mecánico, **Conductor (el default del propio formulario)**,
Socio — lanzaban una excepción no capturada (`send()` no tenía try/catch),
dejando el botón trabado en "Invitar" sin ningún mensaje. Y elegir "Admin"
sí pasaba la validación, pero le habría dado a esa persona co-admin real
sobre TODA la app en Base44 — no el rol de admin de su propio tenant.

**Fix:** `InviteForm.jsx` ahora llama `base44.auth.inviteUser(email,
'user')` — siempre el rol de plataforma neutro con el que arranca
cualquier usuario auto-registrado; el rol real de la app sigue viniendo de
`members[]`, sin cambios. `send()` ahora tiene try/catch real con un estado
de error renderizado vía `FormError`, en vez de una excepción sin capturar.

**Verificado:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm
run test` (467/467) todos limpios contra `@base44/sdk@0.8.44` (el repo
recibió un bump automático del bot de reverse-sync entre el PR anterior y
este). **No verificado:** un round-trip real de invitación en la app en
vivo — no hay sesión de navegador en este entorno; confirmado en su lugar
leyendo directamente los dos módulos del SDK instalado
(`node_modules/@base44/sdk`) y rastreando cuál de los dos llamaba este
formulario y qué hace cada uno.

## Módulo 21 — pantalla "Acerca de": contacto y reconocimiento ACACIA (2026-08-26)

`Help.jsx` ya cubría tres de las cuatro piezas que pide el módulo 21 del
estándar: manual buscable (`ManualGuide`), changelog en la app (módulo 6,
el arreglo `CHANGES`) y el sello de versión (`APP_VERSION`/`RELEASE_DATE`).
Faltaba la cuarta: **"Contacto, y la línea que dice de quién es la app"** —
un correo y un canal directo que de verdad llegue a alguien, distinto del
sistema de tickets (ese ya existe arriba, en la misma pantalla), más un
reconocimiento corto de que esto es un producto ACACIA.

Nueva tarjeta "Contacto" al fondo de `Help.jsx`:
- `soporte@acaciaco.com.mx` — el mismo correo al que ya cae `submitTicket`
  por defecto (`Support_email`/`SUPPORT_EMAIL`/`APP_OWNER_EMAIL`, ver
  `USER_MANUAL.md`) y el que usa `acaciaco-site`'s Soporte a Apps; no un
  valor nuevo inventado para esta tarjeta.
- `SUPPORT_URL` (`src/lib/license.js`, `acaciaco.com.mx/rumbo`) — ya se usa
  para el banner de renovación de licencia en `Layout.jsx`; reutilizado en
  vez de un segundo enlace.
- "Hecho con cariño para floteros y flotillas en México — un producto de
  ACACIA Consultoría" + línea de derechos, con la misma voz que ya usa el
  footer público de `Landing.jsx`.

Bump a v1.32.0. Puramente aditivo — sin cambio de RLS, esquema ni función.

**Verificado:** `npm run lint`, `npm run build`, `npm run typecheck`, `npm
run test` (468/468) todos limpios.

## Módulo 20 — control de sesión: inactividad, un dispositivo activo, sesiones muertas (2026-08-27)

`jospabloh/acacia-app-standard` → `STANDARD.md` §20, las tres capas. Esta app
ya tenía una base parcial de capa 2/3 — `AppSession.jsonc` +
`src/lib/SessionHeartbeat.jsx` — construida para el force-logout de Mission
Control, no para este módulo. Se extendió esa base en vez de reemplazarla.

**Capa 1 — inactividad del lado del cliente (nueva).** `src/hooks/
useSessionManager.js` es una adaptación, no una copia byte a byte, del canónico
`shared/session/useSessionManager.js`: el canónico también gestiona el propio
heartbeat/creación de sesión vía una función `session` (`manageSession`/
`sessionHeartbeat`), que aquí ya hace `SessionHeartbeat.jsx` directamente contra
la entidad `AppSession` — reimplementar eso habría sido un segundo escritor
compitiendo por el mismo renglón. Así que este hook se quedó solo con lo que no
existía: 20 min de inactividad → aviso, 2 min de cuenta regresiva → "sesión
expirada" (con elección explícita: volver a iniciar sesión o cerrar del todo).
`src/components/session/{IdleWarningDialog,SessionExpiredDialog}.jsx` son copias
del canónico con el único cambio necesario: los botones usan `useAuth()` de
este app (`logout`/`navigateToLogin`) en vez de `base44.auth.*` directo. Nuevo
`src/hooks/useActivityTracker.js` — también adaptado, no copiado tal cual: el
canónico alimenta la tabla `usage` de Mission Control vía una función que esta
app no tiene; aquí escribe `AppSession.last_active_at` de la sesión actual,
throttled a 1/hora, disparado por actividad real de DOM — una señal
complementaria (no competidora) al heartbeat por intervalo que ya existía, que
solo prueba "la pestaña sigue abierta", no "alguien hizo algo". Montado todo en
`App.jsx` vía `src/components/session/SessionControl.jsx`, junto a
`SessionHeartbeat`.

**Capa 2 — un dispositivo activo, visible (extiende `AppSession`).** Campo
nuevo `status` (`active`/`passive`, default `active`) **sin** `rls` por campo —
hereda la regla de `update` de la entidad, igual que `last_active_at` ya hace
(el dueño del renglón, vía `created_by_id`, ya puede escribir ambos). Es
deliberado: el propio módulo 20 dice que "un dispositivo activo" es una señal
de UX, no un límite de acceso — un `passive` sigue funcionando exactamente
igual. `SessionHeartbeat.jsx`: un login que crea un renglón NUEVO (no uno
reusado de `sessionStorage`) se marca `status:'active'` y degrada a `passive`
cada OTRA sesión de ese usuario — `src/lib/session/sessionDemotion.js` es la
lógica pura (`pickSessionsToDemote`, con test) que decide cuáles; la lectura ya
está limitada por RLS a los renglones propios (`created_by_id`), así que no hay
forma de que esto alcance a otro usuario. Nueva sección "Sesiones activas" en
la Zona de Peligro — `src/components/admin/ActiveSessions.jsx`, importado y
montado en `DangerZone.jsx` como una sola línea (deliberado: otro agente podía
estar tocando ese archivo en paralelo por otro fix, así que el diff ahí se
mantuvo mínimo). Lista los renglones propios del llamador (RLS de `read` ya
los limita a los suyos — confirmado contra la regla desplegada, no asumido) con
dispositivo, última actividad relativa (`date-fns` + locale `es`) y un botón
"Revocar" en cada uno menos la sesión actual — identificada por el mismo id de
`sessionStorage` que `SessionHeartbeat.jsx` ya cachea, ahora exportado desde un
solo módulo compartido (`src/lib/session/sessionId.js`, constante `SS_KEY`) para
que los dos archivos nunca puedan divergir sobre el nombre de la llave.
"Revocar" es un `base44.entities.AppSession.update(id, {revoked_at, revoked_by})`
directo — confirmado contra la RLS de `update` desplegada que ya permite al
dueño escribir su propio renglón, así que no hizo falta una función nueva.

**Capa 3 — sesiones muertas, recogidas por el servidor (nueva).**
`base44/functions/reapStaleSessions/entry.ts` — revoca cualquier `AppSession`
(`active` o `passive`, las dos por igual) cuyo `last_active_at` tenga más de
48h. Falla CERRADO: sin `CRON_SECRET`, responde 503, nunca "corrió igual" — la
misma disciplina que `requireCron.js` de Mission Control y que los tres
`APP_OWNER_EMAIL`-gated de este repo ya seguían (módulo 14). Revocar es todo lo
que hace falta: el `enforce()` que `SessionHeartbeat.jsx` ya tenía convierte un
`revoked_at` en un logout forzado en el siguiente latido — ningún cambio de
cliente adicional. El cálculo del umbral está duplicado a mano en el propio
`entry.ts` (las funciones Deno de `base44/functions/` no pueden importar de
`src/`, misma razón que el `moduleCan()` en línea de `guardedEntityWrite`) pero
tiene su espejo con test en `src/lib/session/staleThreshold.js`.

**Hueco conocido, dicho explícitamente y no asumido:** este repo no tiene
ningún mecanismo de función programada — se grepeó `CRON`/`cron`/`schedule*`
sobre `base44/` y `docs/` antes de escribir esto y no apareció nada (a
diferencia de Mission Control, que sí tiene `api/cron/*` + `requireCron.js`).
`reapStaleSessions` existe y funciona si se invoca, pero nada en este repo lo
llama todavía con un timer. Conectar un programador de verdad (un cron nativo
de Base44 si la plataforma lo expone para esta app, o uno externo que le
pegue a esta URL con el secreto) queda fuera de este cambio — hace falta
alguien con acceso a esa pieza.

**Verificado:** `npm run lint` (20 endpoints, techo 40), `npm run build`, `npm
run typecheck`, `npm run validate:rls` (27 entidades OK), `npm run test`
(480/480, 12 nuevos en `sessionDemotion.test.js`/`staleThreshold.test.js`) —
todos limpios. `deno check` corrió contra `reapStaleSessions/entry.ts` en este
sandbox (mismo método del módulo 15/16: el binario se baja de GitHub releases)
y compila limpio — hubo que fijar el import a `@base44/sdk@0.8.41` (las otras
19 funciones de este repo usan esa versión; `0.8.44` no resolvió contra la
política de edad mínima de dependencias de `deno check`, un detalle del
sandbox de verificación, no del código).

**Push de esquema en vivo confirmado** (vía Base44 MCP,
`appId 6a15eceffe8dbf6602fa6c35`): `update_entity_schema` sobre `AppSession`
con el esquema completo (los 8 campos + el mismo bloque `rls` de siempre, sin
tocarlo), y una llamada de **lectura separada** (`list_entity_schemas`)
confirma que el campo `status` vive en el esquema desplegado, con el mismo
`enum`/`default`/descripción que el archivo del repo.

**No verificado:** una sesión de navegador real esperando los 20 minutos de
inactividad para ver el aviso y luego el cierre; y poner a mano el
`last_active_at` de un renglón de prueba 49h en el pasado, correr
`reapStaleSessions` de verdad, y confirmar que queda `revoked_at`/pasa a forzar
logout en el siguiente latido — ninguno de los dos alcanzable desde este
entorno de trabajo. El riesgo de la capa 1 está acotado por ser puramente
aditiva (un hook + dos diálogos nuevos, sin tocar `SessionHeartbeat.jsx` más
que para exportar la constante compartida); el de la capa 3, por seguir
exactamente el patrón fail-closed ya usado y verificado en este repo para los
tres `APP_OWNER_EMAIL`-gated del módulo 14.

## Google y correo/contraseña verificados contra la red real; el deploy del sitio sigue pendiente (2026-08-26)

Antes de invitar a un usuario real por Google o por correo, se verificó que
esas dos opciones de verdad funcionan — no se asumió, igual que Apple no se
había asumido roto hasta que un usuario real chocó con el error. El MCP de
Base44 expone `run_command`, que corre dentro del sandbox de la propia app
(con salida a internet real, a diferencia del proxy de este entorno de
trabajo). Con eso:

- **Google:** `GET /api/apps/auth/login?app_id=...` termina, tras sus
  redirects, en `accounts.google.com/v3/signin/identifier?...client_id=
  185178814199-...apps.googleusercontent.com`, HTTP 200 — una pantalla real
  de consentimiento de Google con un `client_id` válido. **Funciona.**
- **Apple (control):** el mismo camino termina en
  `appleid.apple.com/auth/authorize?...` respondiendo **403 Forbidden** de
  los propios servidores de Apple — confirma independientemente, con tráfico
  real, lo que ya se sabía por el reporte del usuario.
- **Correo/contraseña:** `POST /apps/{id}/auth/register` con cuerpo vacío
  responde `422` con un error de validación limpio (`email`/`password`
  requeridos) — el endpoint está vivo y validando normalmente para esta app.

Los tres resultados están grabados (headers y cuerpos completos) en el
historial de esta sesión de trabajo, no solo afirmados.

**Pendiente — el sitio no se ha desplegado.** Los fixes de este archivo (el
botón de Apple, `guardedWrite.js`, `InviteForm.jsx`) están en `main`, pero
—como dice el módulo 11 de este mismo archivo— mergear no deploya el
frontend. `npm run deploy:site` necesita una sesión de Base44 CLI
autenticada que no existe en este entorno de trabajo (ni local ni en el
sandbox de `run_command`, que no es lo mismo que una sesión de desarrollador
logueada). **Alguien con esa sesión tiene que correr `npm run deploy:site`
antes de que Fer o Christian vean cualquiera de estos arreglos en
producción** — hasta entonces, el sitio en vivo sigue sirviendo el bundle
anterior (con el botón de Apple, con `guardedWrite.js` ocultando el error
real). El dato de licencia de Car-Go Rent (arriba) sí es efectivo de
inmediato porque se escribió directo en la base de datos vía MCP, sin pasar
por el frontend desplegado.

## Módulo 7 + 8 — cascada al eliminar un tenant, y el ticket que nadie conectaba (2026-08-26)

`DangerZone.jsx`'s `handleDelete` solo llamaba
`base44.entities.TenantLicense.delete(tenant.id)` directo: borraba el
renglón de licencia y dejaba huérfano, con `tenant_id` apuntando a nada,
cada `Vehicle`/`Driver`/`Trip`/… del tenant. El módulo 7 del estándar
("Deletion must either cascade correctly through your own entities or
explicitly document what it does not touch") y el módulo 8 ("the
account-deletion request in Module 7's danger zone is a ticket too, and it
is the one nobody remembers to wire") piden justo lo que faltaba.

**`base44/functions/deleteTenant/entry.ts`** (nueva, service role), modelada
sobre `exportTenantData`/`delegateOwnership`:

- Deriva `tenant_id` del perfil del caller (`user.data.tenant_id`), nunca
  del cuerpo de la petición.
- Relee el `TenantLicense` **almacenado** y exige
  `stored.owner_email === user.email` — el mismo criterio que
  `delegateOwnership` (módulo 14, 2026-08-24: un `admin` no debe poder
  borrar el tenant, solo su owner real).
- Cascada de entidades: la lista se construyó con
  `grep -l tenant_id base44/entities/*.jsonc` (20 entidades), más completa
  que la lista de 14 de `exportTenantData` — esa es de 2026-08-18 y no
  incluye `Channel`, `Message`, `LocationRequest`, `Catalog`, `UsefulLink`,
  `DriverPrivateNote`, todas agregadas después. Por cada entidad,
  `filter({tenant_id})` y luego borra fila por fila, cada una en su propio
  try/catch — una entidad que falle no aborta el resto; se acumula un
  conteo por entidad en la respuesta.
- Tres casos NO entran al loop genérico, cada uno documentado en el propio
  `entry.ts`:
  - **`User`** — se **desvincula**, no se borra (`tenant_id: null, role:
    'user', suspended: false, write_access: 'enabled', driver_profile_id:
    null` — mismo shape que la acción `remove` de `manageMember/entry.ts`).
    La cuenta sigue viva; la persona puede unirse o crear otro tenant
    después (módulo 18).
  - **`SupportTicket`** — se **conserva**, a propósito. Es el historial de
    soporte/auditoría que un operador de plataforma puede necesitar después
    de que el tenant se fue — el módulo 7 lo pide explícitamente ("billing
    history retained for compliance"). No se toca su `tenant_id`: cada
    renglón ya trae `tenant_name` denormalizado desde su creación
    (`submitTicket/entry.ts`), así que sigue siendo legible por su propio
    rastro de auditoría aunque `tenant_id` deje de resolver a un tenant
    vivo, y no hay riesgo de que se confunda con uno porque el
    `TenantLicense` con ese id ya no existe.
  - **`TenantLicense`** — se borra **al final**, después de que la cascada
    operativa terminó. Si ese borrado falla, la función responde 500 con lo
    ya cascadeado en vez de fingir éxito.
  `AppSession` no tiene campo `tenant_id` (confirmado por el comentario que
  ya traía `AppSession.jsonc`), así que ni siquiera aparece en el grep y
  queda fuera de alcance por completo.
- Ticket de soporte documentando la eliminación (módulo 8): categoría
  `other` (no existe `account_deletion` en el enum de `SupportTicket`, y no
  se justificó inventar uno para esto — la fila del enum), asunto "Tenant
  eliminado: {nombre}", cuerpo con el conteo por entidad, y push a Mission
  Control igual que `submitTicket`. Todo esto es best-effort de punta a
  punta (try/catch que traga el error) — un fallo de ticket o de push
  **nunca** bloquea ni revierte la eliminación, que para entonces ya
  ocurrió.

**`_ticketHelpers.ts` — extraído de `submitTicket/entry.ts`, duplicado por
directorio, no compartido entre directorios.** `nextTicketNumber`,
`pushToMissionControl` y `stripHtml` vivían inline en `submitTicket/entry.ts`;
`deleteTenant` necesita exactamente los mismos tres. La primera opción
considerada fue un solo `base44/functions/_ticketHelpers.ts` compartido
(importado por ambos con `../_ticketHelpers.ts`) — se descartó al revisar
este mismo repo: `_acaciaSign.ts` ya lleva por escrito "Deno isolates each
function directory ... an app with three bridge-touching functions carries
three identical copies — that is expected", y no hay un solo ejemplo hoy de
una función importando un archivo FUERA de su propio directorio. Sin sesión
de CLI/deploy de Base44 autenticada en este sandbox para de verdad probar si
el empaquetado de funciones de Base44 resuelve un import cruzado de
directorios, la opción segura fue seguir el patrón que este repo ya prueba
que funciona: `_ticketHelpers.ts` vive, byte a byte idéntico, en
`submitTicket/` y en `deleteTenant/` — igual que `_acaciaSign.ts` ahora vive
en tres directorios (`acaciaControl`, `submitTicket`, `deleteTenant`) en vez
de dos.

**`src/components/admin/DangerZone.jsx`** — sus tres llamadas a funciones
(`exportTenantData`, `delegateOwnership`, y ahora `deleteTenant`) migraron
de `base44.functions.invoke()` crudo a `src/lib/invokeFunction.js`'s
`invokeOkFunction()`. La razón es la misma que ya documentó el fix de
`guardedWrite.js` arriba (2026-08-26): `base44.functions.invoke()` en esta
app es axios puro (`interceptResponses: false`), así que en una respuesta
no-2xx la promesa se **rechaza** con el mensaje genérico de axios y el
cuerpo real (`{error, ...}`) queda sin leer en `err.response.data`. Las tres
funciones ya usaban `success: true` en vez de `ok: true` en su cuerpo de
éxito; se les agregó `ok: true` (aditivo, sin quitar `success`) porque
`invokeOkFunction` revisa `body.ok`. No había otro llamador de ninguna de
las tres en todo el repo (confirmado por grep), así que el cambio no tiene
efecto en ningún otro lugar.

**Verificado:** `npm run lint` (20 endpoints, techo 40, margen 20), `npm run
build`, `npm run typecheck`, `npm run validate:rls` (27 entidades OK — sin
cambio de esquema), `npm run test` (468/468) todos limpios. `deno check
--node-modules-dir=none` corrió en este sandbox (binario bajado de GitHub
releases, método de los módulos 15/16/18) contra `deleteTenant/entry.ts`,
`submitTicket/entry.ts` y las dos copias de `_ticketHelpers.ts` — los cuatro
compilan limpio. De paso, `deno check` marcó un `error.message` sin `as
Error` preexistente en el catch externo de `submitTicket/entry.ts` (mismo
patrón que el módulo 18 ya documentó para `resolveTenant`/`joinTenant`/
`manageMember` — este repo no corre `deno check` en CI, así que nunca se
había visto); se corrigió de paso, ya que el archivo estaba abierto para
este mismo cambio.

**No verificado:** el deploy en vivo (pendiente de que este PR se mergee y
alguien corra `npm run deploy` — módulo 11) y una sesión de navegador real
como owner de un tenant completando el flujo de "Eliminar tenant" de punta a
punta, incluyendo confirmar que el ticket de eliminación de verdad llega a
Mission Control. Lo de arriba es lectura del código nuevo contra el patrón
ya probado de `delegateOwnership`/`exportTenantData`/`submitTicket`, más la
verificación local (`deno check`, lint, build, typecheck, tests) — no una
ejecución real contra el backend desplegado de Base44.

## Migración completa: todo `base44.functions.invoke()` pasa por el helper (2026-08-26)

El hallazgo del arreglo de arriba (#2, `guardedWrite.js`) — que
`base44.functions.invoke()` es axios puro por `interceptResponses: false`, así
que un no-2xx **rechaza** con el mensaje genérico de axios en vez de resolver
con el cuerpo real (`{error, code?}`) — resultó no ser exclusivo de
`guardedEntityWrite`. Un grep repo-wide encontró ~15 sitios más con el mismo
patrón de invoke crudo, cada uno perdiendo el mensaje de error real de su
función de la misma manera.

`src/lib/invokeFunction.js` generaliza el fix: `invokeFunction(name, payload)`
desenvuelve `{data: <body>}` y, en el catch, lee `err.response?.data` para
recuperar `{error, code}`; `invokeOkFunction` además lanza si el cuerpo trae
`ok: false` en una respuesta 2xx (la convención de `guardedEntityWrite`).
`guardedWrite.js` se migró primero como la prueba del patrón; esta pasada migra
el resto.

**13 archivos migrados**, cada invoke call site revisado uno por uno (no un
reemplazo de plantilla ciego) para no regresar ningún manejo de error ya
cuidadoso:

- `src/components/admin/SuperAdminPanel.jsx` — `licensesAdmin` (`list`,
  `patch`) → `invokeFunction`.
- `src/components/financial/CostPerKm.jsx` — `calculateCostPerKm` →
  `invokeFunction`.
- `src/components/support/TicketForm.jsx` — `submitTicket` → `invokeFunction`;
  el catch ahora muestra `err.message` (el error real del servidor) con el
  mismo texto genérico de antes como respaldo.
- `src/hooks/useFleetMetrics.js` — `fleetUnitMetrics` (dentro de un
  `queryFn` de React Query) → `invokeFunction`; se quitó el
  `if (res?.data?.error) throw` manual, ya cubierto por el helper.
- `src/lib/TenantContext.jsx` — `resolveTenant` y `switchTenant` →
  `invokeFunction`.
- `src/pages/Alerts.jsx` — `generateAlerts` → `invokeFunction`.
- `src/pages/TenantOnboarding.jsx` — `createTenant` → `invokeFunction`; se
  quitó el chequeo manual `data?.error` (código muerto: un no-2xx ya rechaza
  antes de llegar ahí).
- `src/pages/Licenses.jsx` — `licensesAdmin` (`list`, `renew`, `set_status`,
  3 call sites) → `invokeFunction`.
- `src/pages/GitHubPage.jsx` — el wrapper local `invoke()` (`githubRepos`)
  pasó de `base44.functions.invoke(...).then(r => r.data)` a
  `invokeFunction(...)` directo.
- `src/pages/SupabasePage.jsx` — mismo patrón, wrapper local sobre
  `supabaseData`.
- `src/pages/Tickets.jsx` — `ticketsAdmin` (`list`, `set_status`, `reply`,
  3 call sites) → `invokeFunction`.
- `src/pages/Onboarding.jsx` — `joinTenant` → `invokeFunction`; mismo
  chequeo `data?.error` muerto retirado.
- `src/pages/TestData.jsx` — `createTestData` → `invokeFunction`; esta
  función usa `{success: true, summary}` en 2xx y `{error}` en no-2xx (no
  `{ok}`), así que `invokeFunction` (no `invokeOkFunction`) es la que
  encaja — se quitó el `if (response.data?.success)` que ya no hacía falta.

Ninguna de las 13 usa la convención `{ok: bool}` de `guardedEntityWrite` en un
2xx (comprobado leyendo el `entry.ts` de cada función invocada): todas señalan
error con no-2xx + `{error}`, así que `invokeFunction` —no
`invokeOkFunction`— es la elección correcta en los 13 casos.

**Deliberadamente NO tocado:** `src/components/admin/DangerZone.jsx` — sigue
con dos invokes crudos (`exportTenantData`, `delegateOwnership`). Otro agente
puede estar migrándolo en un branch paralelo sin mergear; tocarlo aquí
arriesgaba un conflicto innecesario. Queda pendiente para esa migración o una
pasada posterior. `src/lib/__tests__/guardedWrite.test.js` tampoco se tocó —
no es un call site real, es el mock que fija el comportamiento de
`guardedWrite.js` con un `invoke` falso.

**Sin bump de versión.** Precedente en este mismo repo: `494aa29`
(audit-tenant-scope), `06084e9`/`d07247a` (flag `ACCEPT_LEGACY_MASTER`),
`57d4dd2` (solo CLAUDE.md) y `f2aceaf` (recomendaciones de RLS) — los cuatro
son cambios internos sin funcionalidad nueva de cara al usuario y ninguno tocó
`package.json`. Este cambio es la misma categoría: mensajes de error más
específicos en fallo, comportamiento idéntico en éxito, sin RLS ni esquema ni
función nuevos.

**Verificado:** `npm run lint` (19 endpoints, sin cambio — esta migración no
toca `base44/functions/`), `npm run build`, `npm run typecheck`, `npm run
validate:rls` (27 entidades OK, sin cambio de esquema — no se tocó ningún
`.jsonc`), `npm run test -- --run` (468/468) — todos limpios.

## `switchTenant` no cambiaba de tenant: los campos custom de User se escribían fuera de `data` (2026-08-31)

Encontrado en vivo, en la propia cuenta de ACACIA (`h.josepablo@gmail.com`,
recién re-agregada como miembro de un segundo tenant — Car-Go Rent — el mismo
día). Al elegir la otra organización en el selector, la página se recargaba,
no mostraba error, y volvía a caer en la organización original — siempre.

**Causa raíz.** Los campos custom de `User` (`tenant_id`, `driver_profile_id`,
`write_access`, `suspended` — todo lo que las RLS referencian como
`{{user.data.X}}`) se guardan bajo un objeto anidado `data`, no en la raíz del
registro. Confirmado leyendo el registro crudo vía el MCP de Base44: su
`data.tenant_id` seguía apuntando al tenant original, mientras un `tenant_id`
suelto en la raíz (escrito segundos antes por `switchTenant`) sí tenía el
nuevo. Toda función que hace `svc.entities.User.update(id, {tenant_id, ...})`
con un objeto **plano** estaba escribiendo esos campos en la raíz del
documento en vez de dentro de `data` — así que `switchTenant` respondía
`ok: true` y de verdad persistía *algo*, solo que no el campo que
`resolveTenant`/las RLS en verdad leen.

**Por qué nadie lo había encontrado antes.** `resolveTenant` recalcula la
pertenencia desde cero (creador, `owner_email` o `members[]`) cada vez que no
hay nada persistido y usable — y para un usuario de un solo tenant, ese
recálculo siempre cae en la misma única respuesta, sin importar si el guardado
anterior de verdad funcionó. El bug era invisible para cualquier cuenta normal
de un tenant. Solo se vuelve observable con `switchTenant`, cuya única función
es mover la elección **persistida** entre dos candidatos que ya son válidos
por sí mismos.

**El mismo bug, con menos escándalo, en otras cinco funciones** que hacen este
mismo update plano: el propio patch de `resolveTenant`, `createTenant`,
`joinTenant`, `manageMember` (suspend/reactivate/remove) y el desvincular por
usuario de `deleteTenant`. `manageMember` merece nombrarse aparte: si
`data.write_access`/`data.suspended` nunca se actualizaban de verdad, el
bloqueo de escritura de un usuario "suspendido" puede no haber estado
surtiendo efecto — misma causa raíz, síntoma distinto, que nadie había
reportado todavía.

**Arreglo:** las seis funciones ahora anidan
`tenant_id`/`driver_profile_id`/`write_access`/`suspended` bajo una clave
`data: {...}` explícita en la llamada a `update`; `role` se queda plano — es
un campo genuino de plataforma, las RLS lo referencian como
`user_condition: {role: ...}` sin el prefijo `data.`, nunca como `data.role`.

**Verificado:** `npm run lint` (21 endpoints), `npm run build`, `npm run
typecheck`, `npm run validate:rls` (27 entidades OK, sin cambio de esquema),
`npm run test -- --run` (480/480) — todos limpios. `deno check
--node-modules-dir=none` corrió contra las seis funciones cambiadas (binario
de GitHub releases, método ya documentado en este archivo) y las seis
compilan limpio — de paso se corrigieron cuatro `error.message` sin
`as Error` preexistentes en `createTenant`/`manageMember`/`resolveTenant`/
`joinTenant` (mismo patrón que otras funciones de este repo ya tenían,
nunca antes visto porque este repo no corre `deno check` en CI).

**No verificado:** una repetición en vivo del switch después de que esto se
despliegue — pendiente de que alguien con sesión de CLI de Base44 autenticada
corra `npm run deploy` (módulo 11: mergear no deploya). La cuenta que
encontró el bug debe reintentar el cambio de organización una vez esté en
producción.

## Un segundo `write_access` sin anidar, encontrado releyendo el propio deploy (2026-09-01)

El fix de arriba (2026-08-31) dijo por escrito que arreglaba "los dos resets
rápidos de `write_access: 'enabled'`" en `resolveTenant`. Arregló uno.

Se encontró releyendo el **código desplegado de verdad** vía el MCP de
Base44 justo después de que el deploy manual de esta corrección terminara —
la misma disciplina del módulo 14 ("contra el esquema desplegado, no contra
el archivo del repo"), aplicada aquí a una función en vez de a un esquema.
El segundo call site — el reset que corre cuando un usuario se queda con
**cero** tenants candidatos (perdió o dejó su única organización) — seguía
escribiendo `{ write_access: 'enabled' }` plano. Misma consecuencia que
cualquier otra instancia de este bug: el write "funciona" pero
`data.write_access` nunca se mueve de `'blocked'` — un usuario que se quedó
sin su último tenant estando bloqueado podía seguir bloqueado en silencio
después de un reset que se suponía que lo liberaba.

**Arreglo:** anidado bajo `data: { write_access: 'enabled' }`, igual que el
call site hermano once líneas arriba y que el resto del archivo.

**Verificado:** `npm run lint` (21 endpoints), `npm run build`, `npm run
typecheck`, `npm run validate:rls` (27 entidades OK, sin cambio de esquema),
`npm run test -- --run` (480/480) — todos limpios. `deno check
--node-modules-dir=none` sobre el archivo cambiado compila limpio.

**No verificado:** una repetición en vivo de este caso exacto (un usuario
con cero tenants candidatos y `write_access` ya en `'blocked'`) — un borde
angosto, no fácil de reproducir a salvo contra datos reales desde este
entorno; confirmado en su lugar releyendo el código fuente desplegado
directamente y comparando el diff contra el patrón ya probado del fix de
2026-08-31.

**Lo que esto enseña:** "arreglé los N call sites" es una afirmación que
hay que releer del código desplegado, no del propio resumen del fix — el
mismo archivo que documentó por qué "ya estaba puesto" no vale sin
comprobarlo (módulo 15, 2026-08-24) casi repite el error un día después,
solo que sobre un `grep` incompleto en vez de una variable de entorno.

## El `role` en el patch tumbaba el `tenant_id`: un update atómico que fallaba entero (2026-09-01)

**La causa real del selector de organización, y no era ninguna de las dos que
este archivo documentó antes.** La encontró un agente externo (el builder de
Base44) y la dejó escrita en `switchTenant` con el error literal de la
plataforma:

> `You cannot update the role of the owner of the app`

Base44 **rechaza cambiar el rol del owner de la app aunque la llamada corra con
service role**. Y `User.update` es **atómico**: mandar `role` en el mismo patch
que `data.tenant_id` hace que se pierda **todo** el update. Por eso el switch
respondía `ok: true` sin cambiar nada — la escritura nunca ocurría.

**Las dos correcciones anteriores de este archivo (1.34.1 y 1.34.2) eran ruido.**
Se dedicaron a mover el dato entre `data` y la raíz razonando sobre **un solo
registro roto**, sin haber comprobado nunca que la escritura siquiera se
ejecutaba. La pista estaba en el log de la función, que nadie leyó — exactamente
el mismo error que el módulo 15 ya documentó ("un respaldo que nombra culpables
no vale nada si nadie lee lo que nombró"), repetido con otra ropa.

**Lo que esta versión añade sobre el hallazgo del agente:**

1. **El guard dependía de `APP_OWNER_EMAIL`.** El arreglo original omite `role`
   sólo si `isAppOwner`, y eso se deriva de esa variable. Sin ella, `isAppOwner`
   es `false` y el bug vuelve entero — el modo de fallo que este repo ya
   documentó dos veces (módulo 14 con `CRON_SECRET`, módulo 15 con
   `ACACIA_APP_SLUG`). Ahora **el rol se manda siempre en su propia llamada**,
   así que un rechazo no puede arrastrarse el tenant, esté puesta o no.
2. **El mismo fallo vivía en otras cinco funciones**, todas con `role` junto a
   `data` en un update atómico: `resolveTenant` (corre en **cada carga de
   página** — un rechazo deja al usuario sin binding de tenant, en silencio),
   `createTenant` (el owner de la app creando una organización: su `tenant_id`
   nunca se fija y el tenant nace sin su dueño enganchado), `joinTenant`,
   `manageMember` (remove) y `deleteTenant` (desvincular usuarios).

En las seis: primero los campos de tenant, después el rol en una llamada aparte
con `try/catch` que **registra el rechazo** en vez de perder la operación
entera. La respuesta devuelve el rol **realmente aplicado**, no el pretendido.

**La lección, y esta vez es sobre método, no sobre Base44:** tres intentos de
arreglo y los dos primeros fueron míos razonando sobre la forma del dato. Nunca
comprobé lo primero que había que comprobar — **si la escritura se estaba
ejecutando siquiera**. Un `ok: true` prueba que la función terminó, no que
escribió; y el registro con tres copias del `tenant_id` invitaba a teorizar
sobre cuál era la buena en vez de preguntar por qué ninguna se movía. Cuando un
write "no toma", mira el log de la escritura antes que la forma del documento.

## `base44.auth.inviteUser` nunca acepta la sesión de un usuario final — el invite ya no lo llama (2026-09-10)

Reportado en vivo por Christian Cabral (owner de Car-Go Rent, por WhatsApp,
con captura de pantalla): "Invitar" en Administración respondía
`Could not validate credentials` para cualquier correo, con cualquier rol,
siempre.

**Reproducido contra el endpoint real, no asumido.** `POST
https://base44.app/api/apps/{id}/users/invite-user` con un Bearer
deliberadamente inválido devuelve exactamente el mismo mensaje
(`Could not validate credentials`, 401) que Christian veía con su propia
sesión real, mientras que sin cabecera de autorización el mismo endpoint
responde un mensaje **distinto** (`No authentication header...`). Eso aisla
la causa: el endpoint recibe el Bearer de Christian, syntax válida, pero lo
rechaza igual que rechazaría basura — no es un token ausente ni corrupto en
tránsito, es que ese endpoint de la **plataforma** de Base44 no reconoce como
válida la sesión normal de un usuario final de la app, sin importar su rol
dentro del tenant (el propio Christian es `owner` de Car-Go Rent). Revisado
también el SDK instalado (`node_modules/@base44/sdk/dist/client.js`):
`serviceRoleModules` (lo que expone `base44.asServiceRole.*` dentro de una
función Deno) **no incluye un módulo `auth`** — no existe
`asServiceRole.auth.inviteUser`, así que tampoco hay forma de llamar a este
endpoint con credenciales elevadas desde una función de servidor. En la
práctica, este endpoint del SDK no tiene ningún camino que funcione desde
esta app para un owner de tenant.

**Esto revierte parte de lo documentado en el hallazgo del 2026-08-26** (más
arriba, "Invitar por correo llamaba al invite de la PLATAFORMA..."): ese fix
migró correctamente `base44.users.inviteUser` (el invite de colaborador del
estudio, con roles restringidos a `user`/`admin`) a `base44.auth.inviteUser`
(supuestamente "pensado para dar de alta a un usuario final de la app"), pero
nunca se verificó en vivo — quedó anotado explícitamente como "no
verificado". Christian fue quien de verdad lo probó primero, y ninguno de los
dos métodos del SDK funciona para un tenant owner.

**El arreglo no repara la llamada — la elimina.** `InviteForm.jsx` ya no
llama a ningún método de invite de Base44. El propio código ya escribía
`members[]` del `TenantLicense` al invitar (para que `resolveTenant` la
reconozca en su primer login, igual que el código de unión) — esa escritura
es la única pieza que de verdad ata a alguien al tenant. Ahora es la única
que ocurre: el formulario agrega el correo a `members[]` y le dice al admin
que comparta el link de login (`{origen}/login`) con la persona invitada;
en cuanto esa persona entra por su cuenta — Google o registro con
correo/contraseña, usando ese mismo correo — `resolveTenant` la reconoce sola.
Se pierde el correo automático de invitación que Base44 mandaría (si es que
lo manda; tampoco se pudo verificar, porque el endpoint nunca respondió
éxito), pero se gana que la función **funcione**, para cualquier tenant
owner, sin depender de un endpoint de plataforma cuyo modelo de permisos no
es el de esta app.

**Verificado:** `npm run lint` (20 endpoints), `npm run build`, `npm run
typecheck`, `npm run test -- --run` (241/241 en los archivos que corrieron).
Dos suites preexistentes (`permissionsSync.test.js`, `modulePerms.test.js`,
ninguna relacionada con `InviteForm.jsx`) fallan en este sandbox de
verificación con `[Base44 SDK Error] undefined: Network Error` al importar
`TenantContext.jsx` durante la colección de tests — confirmado que es un
problema de red del propio sandbox (no de este cambio) reproduciendo el
fallo aislado con `npx vitest run` sobre ese archivo solo. Sin cambio de RLS
ni de esquema.

**No verificado:** el deploy en vivo (pendiente de `npm run deploy:site` —
módulo 11) ni que Christian repita la invitación una vez desplegado.

## Unirse por código devolvía al menú de onboarding aunque la unión ya había funcionado — la misma trampa del módulo 22, un nivel arriba (2026-09-10)

Reportado en vivo por jose.herrera@acaciaco.com.mx: unirse a Car-Go Rent con
el código `RUMBO-A3ZUPR` mostraba "¡Te uniste! Preparando tu acceso…" y
luego regresaba a la pantalla de elegir organización — como si nunca hubiera
pasado nada.

**Confirmado leyendo la base de datos directo, antes de tocar nada:** la
unión sí había funcionado. El `User` de jose.herrera tenía `data.tenant_id`
apuntando correctamente a Car-Go Rent, `role: "driver"`, y el
`TenantLicense` de Car-Go Rent ya lo llevaba en `members[]`. El guardado
estaba perfecto — el bug vivía en el cliente, no en `joinTenant`.

**La causa es el módulo 22 del estándar, aplicado un nivel más arriba de
donde ya lo habíamos cazado.** `resolveTenant` (vía `asServiceRole`, inmune
a cualquier vista contaminada) siempre resolvía el `tenant_id` correcto —
pero solo devolvía el id, no el registro. `TenantContext.jsx`'s
`loadTenant()` tomaba ese id y volvía a buscar el `TenantLicense` completo
llamando **desde el cliente** a `base44.entities.TenantLicense.list()` — una
llamada que sí pasa por las reglas de seguridad de la entidad:
`{"read": {"$or": [{"data.owner_email": "{{user.email}}"}, {"id":
"{{user.data.tenant_id}}"}]}}`. Para alguien que se acaba de unir por
código (no es `owner_email` de nada), la única rama que aplica es
`id === {{user.data.tenant_id}}` — y esa comparación depende de que la
plataforma ya haya refrescado SU PROPIA vista de `user.data.tenant_id` para
ese usuario, justo el mismo tipo de lectura que el módulo 22 ya probó que
puede quedarse atrás del documento real. El resultado: la lista devuelta
por `TenantLicense.list()` no incluía a Car-Go Rent aunque el campo ya
estuviera bien escrito, `TenantContext` no encontraba nada, `tenantId` se
quedaba en `null`, y `TenantGate` interpretaba eso como "todavía no tienes
organización" — de vuelta al onboarding, en bucle, sin ningún error visible
en ningún lado.

**Por qué crear una organización nueva nunca lo había mostrado:** la misma
RLS tiene una PRIMERA rama, `data.owner_email === {{user.email}}` — y el
correo del llamador es una identidad estable que no depende de ninguna
escritura reciente. Quien CREA su tenant siempre entra por esa rama, inmune
al problema; quien se UNE por código solo puede entrar por la segunda, la
que sí depende del campo recién escrito. El mismo bug llevaba ahí desde que
existe `joinTenant`, invisible porque nadie se había unido por código desde
que el resto de la investigación de esta sesión empezó a poner atención aquí.

**El arreglo no repara la segunda lectura — la elimina, igual que con
`switchTenant` en su momento.** `resolveTenant/entry.ts` ahora devuelve el
registro **completo** del tenant (`tenant`, no un subconjunto de campos ni
solo el id) — ya lo había resuelto por su cuenta vía `asServiceRole`, así que
no hay ninguna razón para que el cliente lo vuelva a buscar por una vía que
puede fallar. `TenantContext.jsx` ahora usa ese objeto directo; **solo**
llama a `TenantLicense.list()` como respaldo si `resolveTenant` falló por
completo (error de red, no un "no te encontré"). No es una fuga de datos:
la RLS de lectura de `TenantLicense` ya concede el registro entero a
cualquier rol en cuanto esa misma comparación empareja — esto solo deja de
depender de ella para descubrir el tenant la primera vez.

**De paso, un hallazgo de datos, no de código:** revisando el mismo tenant,
`max_vehicles` y `max_drivers` de Car-Go Rent volvían a tener un tope manual
(5 y 5) por debajo del que le corresponde a su plan `starter` (15 y 20) —
mismo tipo de override suelto que ya se había corregido el 2026-08-26 en
este mismo tenant (`max_vehicles` únicamente, esa vez). Con 10 unidades y
varios conductores activos, un tope de 5 en cualquiera de los dos ya estaba
por debajo de lo real. Quitado otra vez vía `$unset` por el MCP de Base44 —
no hay código que lo esté re-escribiendo (`licensesAdmin`'s `patch` es el
único escritor y no toca estos campos en ningún otro flujo), así que fue
otra edición manual, no un bug que vaya a repetirse solo.

**Verificado:** `npm run lint` (22 endpoints), `npm run build`, `npm run
typecheck`, `npm run test -- --run` (241/241 en los archivos que corrieron;
las mismas dos suites preexistentes y no relacionadas con este cambio
siguen fallando por el problema de red del propio entorno de verificación
ya documentado arriba). `deno check --node-modules-dir=none` sobre
`resolveTenant/entry.ts` compila limpio. El dato de Car-Go Rent se
confirmó leído de vuelta (ambos campos ausentes del registro). Sin cambio
de esquema.

**No verificado:** el deploy en vivo (pendiente de `npm run deploy:site` —
módulo 11) ni que jose.herrera vea reflejado el cambio después de
desplegado — su cuenta ya quedó correctamente unida en la base de datos
desde antes de este fix; el fix es lo que hace falta para que la PRÓXIMA
persona que se una por código no se quede atorada de la misma forma.

## La causa real, por fin: `auth.me()` no es confiable para decidir si hay que escribir (2026-09-03)

El fix del `role` de arriba (2026-09-01) era necesario pero no era el bug que
seguía impidiendo el switch para h.josepablo@gmail.com — su rol en Car-Go Rent
(`admin`) ya coincidía con su rol global, así que la rama de `role` nunca se
ejecutaba para este caso concreto. El switch seguía sin mover nada, sin
error visible, tras dos intentos reales más (uno en ventana de incógnito, para
descartar caché del navegador — mismo resultado).

**Se instrumentó `switchTenant` con una entidad de diagnóstico (`DebugProbe`,
ya retirada de este archivo) que grababa el estado exacto en cada paso.** El
registro `entry` de un intento real mostró esto, sin interpretación:

```
requestedId:      6a4c67c5131100e9f96e1e51  (Car-Go Rent, el destino)
user.data (de auth.me()).tenant_id: 6a4c67c5131100e9f96e1e51  (¡ya igual al destino!)
```

Con `user.data.tenant_id` (leído de `auth.me()`) YA IGUAL al candidato, el
`dataPatch` salía vacío — la función concluía "nada que cambiar" y respondería
`ok:true` sin escribir un solo campo. Pero una relectura del documento real,
en el MISMO request, vía `asServiceRole` (`svc.entities.User.filter`), mostró
el valor verdadero: el tenant anterior, sin mover un campo desde días atrás
(`updated_date` congelado). Una consulta independiente mía, minutos después,
confirmó el mismo valor verdadero — no era un problema de réplica que se
resolviera solo.

**`auth.me()` estaba devolviendo un `user.data.tenant_id` que NUNCA existió en
el documento persistido.** La explicación: este perfil arrastraba un campo
`tenant_id` suelto en la **raíz** del documento (`6a4c67c5131100e9f96e1e51`,
residuo de un intento de fix anterior en esta misma investigación que escribió
plano en vez de bajo `data`) — y ese valor coincide EXACTO con lo que `auth.me()`
reportó como `user.data.tenant_id`. `auth.me()` reconstruye su `.data` de
conveniencia contaminado por ese resto en la raíz, no por el `data.tenant_id`
real que las RLS sí leen. Cualquier función que compare contra `user.data` de
`auth.me()` para decidir si escribir puede terminar comparando contra un valor
que nunca estuvo realmente persistido — y saltarse la escritura que en verdad
hacía falta, exactamente como aquí.

**Fix: ninguna de las seis funciones de este flujo vuelve a leer `user.data` de
`auth.me()`.** `switchTenant`, `resolveTenant`, `joinTenant`, `manageMember` y
`deleteTenant` ahora hacen una relectura fresca del propio perfil por servicio
(`svc.entities.User.filter({id: user.id})`) al entrar, y todo el cálculo de
"qué cambió" usa esa relectura (`selfData`/`selfRole`), nunca `user.data`/
`user.role` del objeto que entregó `auth.me()`. `createTenant` no necesitaba el
cambio: su escritura ya era incondicional, sin diff. De paso, los `data:{...}`
que solo mandaban los campos cambiados ahora esparcen `selfData`/`target.data`
completo debajo (`{...selfData, ...dataPatch}`) — por si la plataforma reemplaza
el subdocumento entero en vez de mezclarlo, como los comentarios de este mismo
archivo venían advirtiendo sin que nadie lo hiciera explícito hasta ahora.

La entidad `DebugProbe` y su instrumentación ya se retiraron de `switchTenant`
(el archivo quedó limpio); el esquema `DebugProbe` en sí se puede borrar a mano
desde el panel de Base44 cuando alguien pase por ahí — no tiene tráfico ni RLS
abierta (solo owner), así que no urge.

**Verificado:** `deno check --node-modules-dir=none` sobre las cinco funciones
cambiadas (binario de GitHub releases, método ya documentado en este archivo) —
las cinco compilan limpio. Confirmado en vivo en GitHub que el commit llegó a
`main` byte por byte igual a lo escrito. **No verificado todavía:** el deploy a
producción (pendiente de `npm run deploy` — solo funciones, sin cambio de
esquema, `deploy:entities` no hace falta esta vez) ni un intento real de switch
contra el código corregido. Es la pieza que falta antes de dar esto por
resuelto.

## Auditoría incremental (2026-09-07) — el fix del 09-03 cubrió 5 de 14 lectores de `user.data`

Pasada de auditoría rutinaria (no repite RLS/módulos ya cerrados desde cero;
busca lo nuevo o regresado). Inventario: rama `claude/relaxed-galileo-ln6fwl`
al día con `main` y con su propio remoto, sin ramas de auditoría duplicadas ni
sueltas; el HEAD de `main` ya incluía todo el trabajo hasta el 2026-09-03
(`auth.me()` no confiable) vía los reverse-sync commits de
`base44-builder[bot]`.

**Hallazgo — el fix del 2026-09-03 dejó 9 funciones más con el mismo patrón.**
Ese fix corrigió `switchTenant`, `resolveTenant`, `joinTenant`, `manageMember`
y `deleteTenant`: las cinco leían `user.data` de `auth.me()` para decidir un
WRITE, y `auth.me()` puede reconstruir `.data` contaminado por restos de
campos en la raíz del documento (residuo de los updates planos de antes del
2026-08-31, nunca limpiado). Un grep sobre las 21 funciones (`user\.data` fuera
de comentarios) encontró **nueve más** con exactamente el mismo patrón,
nunca tocadas por esa pasada:

- **`guardedEntityWrite`** — el candado de escritura para las 17 entidades
  module-scoped (módulo 3). Lee `user.data.tenant_id`, `write_access` y
  `driver_profile_id` directo de `auth.me()`. Si estos están contaminados: un
  `tenant_id` viejo podría escribir contra el tenant equivocado, y un
  `write_access` viejo podría dejar escribir a un tenant recién bloqueado por
  facturación o a un usuario recién suspendido/removido por `manageMember` —
  exactamente la garantía que `manageMember` cree estar dando.
- **`manageRole`** (módulo 2, 2026-08-26 — anterior al fix del 09-03, así que
  simplemente no se incluyó) — deriva el `tenant_id` del propio admin que
  cambia el rol de otro miembro desde `caller.data`, sin releer.
- `calculateCostPerKm`, `createTestData`, `delegateOwnership`,
  `exportTenantData`, `fleetUnitMetrics`, `generateAlerts`, `submitTicket` —
  mismo patrón, radio de daño menor (reportes, exportación, tickets).

**Fix:** las nueve ahora hacen la misma relectura fresca por service role
(`svc.entities.User.filter({id: user.id})`) antes de derivar `tenant_id` (y en
`guardedEntityWrite`, también `write_access`/`driver_profile_id`) — mismo
patrón exacto que las cinco funciones del 09-03. `role` se sigue leyendo de
`user.role` en todas partes: es un campo genuino de plataforma, no parte del
`.data` que puede contaminarse.

**De paso:**
- Se borró `base44/entities/DebugProbe.jsonc` — el propio CLAUDE.md ya decía
  que no tenía tráfico ni RLS abierta y se podía borrar cuando alguien pasara
  por ahí. `validate:rls` vuelve a 27 entidades.
- `src/components/admin/TenantEditor.jsx` tenía un `<Input>` editable para
  "Email del owner" que mandaba `owner_email` en un
  `TenantLicense.update()`/`.create()` directo — pero ese campo es
  `rls.write:false` desde el módulo 14 (2026-08-24). El write se descartaba en
  silencio (en `update`) o dejaba el `owner_email` sin fijar del todo (en el
  fallback de `create` "sin licencia todavía", que no tiene default de
  esquema para ese campo) mientras la interfaz sugería que el cambio se había
  guardado. Ahora es un texto de solo lectura que apunta a "Delegar
  propiedad" en la Zona de Peligro — el único camino que de verdad funciona
  desde `delegateOwnership` (módulo 14, 2026-08-24).
- Cuatro hallazgos de `deno check` preexistentes en archivos que ya estaban
  abiertos por el fix de arriba (`error.message` sin cast en
  `calculateCostPerKm`/`createTestData`/`generateAlerts`, parámetros
  implícitamente `any` en `generateAlerts`, una restricción genérica
  innecesaria en `fleetUnitMetrics.argBest`) — corregidos de paso, mismo
  criterio que el módulo 18 ya estableció para este tipo de hallazgo. Ninguno
  cambia comportamiento en runtime.
- XSS almacenado en `NoteComposer.jsx` (esquemas `javascript:`/`data:` en un
  enlace de nota) — releído y confirmado ya arreglado por un commit anterior
  (`c55e548`, 2026-09-01): valida el esquema al agregar el enlace, y el único
  render de esos adjuntos (`UnitDayCellDetail.jsx`, `<a href>`) ya lleva
  `rel="noopener noreferrer"`. No requirió ningún cambio nuevo en esta pasada.
- Revisadas las 27 entidades por rama de rol sin `$and` a `tenant_id` (el
  patrón de `Parish`/cateqhub que motiva el módulo 14) en `create`/`update`/
  `delete`/`read` — sin hallazgos nuevos; las únicas ramas de rol sin
  `tenant_id` son `TenantLicense.create`/`User.create` (no hay tenant que
  scopear todavía en esas operaciones) y `AppSession` (no tiene campo
  `tenant_id`, confirmado por su propio comentario).
- Confirmados sin cambios: los 10 candados de licencia + `owner_email` en
  `TenantLicense.jsonc`; cero llamadas directas `base44.entities.*` en `src/`
  a las 17 entidades module-scoped (todo pasa por `guardedWrite.js`); las tres
  funciones de plataforma (`githubRepos`, `supabaseData`, `licensesAdmin`)
  siguen fallando CERRADO sin `APP_OWNER_EMAIL`; `reapStaleSessions` sigue
  fallando CERRADO sin `CRON_SECRET`; `ACCEPT_LEGACY_MASTER = false` en las
  tres copias de `_acaciaSign.ts` (`acaciaControl`, `submitTicket`,
  `deleteTenant`, byte a byte idénticas entre sí).

Bump a v1.34.4 — sí hay un cambio de comportamiento observable
(`TenantEditor.jsx`), aunque menor.

**Verificado:** `npm run lint` (21 endpoints, techo 40), `npm run build`, `npm
run typecheck`, `npm run validate:rls` (27 entidades OK), `npm run test --
--run` (480/480) — todos limpios, antes y después del cambio. `deno check
--node-modules-dir=none` corrió contra las nueve funciones tocadas (binario de
GitHub releases, método ya documentado en este archivo) — las nueve compilan
limpio.

**No verificado:** el deploy en vivo (pendiente de merge + `npm run deploy` —
módulo 11; esta vez sin cambio de esquema salvo el borrado de `DebugProbe`,
que si no se sincroniza solo, se puede borrar a mano desde el panel), y
ninguna sesión de navegador real (ni con el selector de organización, ni con
el editor de tenant, ni con ningún flujo de escritura de los nueve archivos
tocados) — no alcanzable desde este entorno de trabajo. El riesgo de las
nueve relecturas está acotado por ser el mismo patrón ya verificado en
producción para las cinco funciones del 09-03 (mecánicamente idéntico:
sustituir `user.data` por una relectura fresca por service role, sin tocar
ninguna otra lógica de autorización); el de `TenantEditor.jsx`, por ser una
reducción de superficie (un campo que ya no escribía nada pasa a no
pretender que escribe).

## Retirado: el selector de organización (antes módulo 18) — 2026-09-10

**Un usuario pertenece a una sola organización.** El selector que permitía a un
mismo email moverse entre varios `TenantLicense` se quitó entero: nunca llegó a
funcionar en producción, y la historia de arriba —tres secciones fechadas, tres
causas raíz distintas, dos de ellas mías y equivocadas— es la razón por la que
la decisión fue retirarlo en vez de seguir arreglándolo.

Lo que se fue:

- `base44/functions/switchTenant/` — la función entera. Era el único camino
  sancionado para mover `data.tenant_id` después del primer enganche; sin ella
  ese binding es definitivo mientras exista.
- `src/components/TenantPicker.jsx` y `src/components/TenantSwitcher.jsx` — la
  pantalla de elección y el control del sidebar.
- `src/pages/JoinOrganization.jsx` y su ruta `/join-organization` — sólo existía
  para llegar a "unirme a otra organización" desde dentro de la app.
- `candidates` / `needs_tenant_choice` en `resolveTenant` y en
  `TenantContext.jsx`. `resolveTenant` vuelve a tomar el **primer** tenant que
  empareja (creador → `owner_email` → `members[]`) sobre la lista ya ordenada
  por `-created_date`, así que sigue siendo determinista.

**Y una puerta que hubo que volver a poner, porque sin el selector su ausencia
sí hace daño:** `joinTenant` responde otra vez `409` si el caller ya tiene
`data.tenant_id` de otra organización. Con selector, redimir un código movía el
tenant activo y podías volver; sin selector, unirte a una segunda organización
dejaría la primera **inalcanzable para siempre**. Unirse a la misma a la que ya
perteneces sigue siendo idempotente. Darse de baja es cosa del administrador de
la organización (`manageMember`).

**Lo que NO se tocó, a propósito:** los arreglos que salieron de perseguir este
bug se quedan, porque ninguno era del selector — la relectura fresca del perfil
por `asServiceRole` en vez de `user.data` de `auth.me()` (2026-09-03 y la
extensión del 09-07 a nueve funciones más), el `role` en su propia llamada
separada del patch de `data` (2026-09-01), y el anidado bajo `data:{...}`
(2026-08-31). Los tres eran bugs reales de escritura de perfil que afectaban a
`resolveTenant`, `joinTenant`, `manageMember`, `deleteTenant` y
`guardedEntityWrite` — funciones que siguen vivas y corriendo en cada carga de
página.

**Verificado:** `npm run lint` (20 endpoints, techo 40), `npm run build`,
`npm run typecheck`, `npm run test -- --run` (480/480) y `deno check
--node-modules-dir=none` sobre `resolveTenant` y `joinTenant` — todos limpios.
**No verificado:** el deploy (módulo 11: mergear no deploya; hacen falta
`npm run deploy` y `npm run deploy:site`) ni una sesión de navegador. Ojo con
un caso concreto que este repo ya documentó: `h.josepablo@gmail.com` empareja
con **dos** `TenantLicense` ("Car-Go Rent" y "Owner"). Ya tiene `tenant_id`
persistido, así que la rama 1 lo conserva y no cambia nada para esa cuenta —
pero si alguien le limpia el binding, `resolveTenant` lo dejará en el más
reciente de los dos y no habrá forma de moverlo desde la app.

## `Driver.jsonc`: la misma trampa de `resolveTenant` un nivel más abajo, y se revirtió sola una vez (2026-09-10)

Disparado por el mismo caso real de arriba (unirse por código): con el bug del
selector de organización arreglado, jose.herrera@acaciaco.com.mx quedaba
correctamente unido a Car-Go Rent (confirmado leyendo el registro), pero
`DriverProfile.jsx` seguía mostrando "Tu expediente no está configurado aún.
Contacta al administrador." aunque su `Driver.profile_id` ya apuntaba a él.

**Causa raíz — el mismo patrón que `resolveTenant`, un nivel más abajo.**
`Driver.read`/`Driver.update` ataban la excepción de auto-lectura del
conductor (`data.profile_id == {{user.id}}`) **dentro** del mismo `$and` que
exige `data.tenant_id == {{user.data.tenant_id}}`. Justo después de que
`resolveTenant` escribe el `tenant_id` nuevo en el perfil, la plataforma tarda
una ventana corta en reflejar ese valor en las evaluaciones de RLS del cliente
— la misma inconsistencia ya documentada arriba para `TenantLicense.list()`.
Mientras esa ventana no cierra, ni siquiera la rama de auto-lectura evalúa,
porque comparte el `$and` con la comparación de tenant que todavía falla.

**Arreglo:** en `read` y `update`, la rama `data.profile_id ==
{{user.id}}` sale del `$and` a un `$or` de nivel superior — igual que ya se
hizo para `owner_email` en `TenantLicense` (módulo 14, 2026-08-24): un
conductor siempre puede leer/editar (con `write_access` habilitado, en
`update`) su propio registro, sin importar si `tenant_id` ya se resolvió en
esta sesión.

**Aplicado dos veces, porque la primera se revirtió sola.** El primer parche
se aplicó en vivo vía el MCP de Base44 y quedó capturado en el repo por el
reverse-sync automático de `base44-builder[bot]` (commit `e481964`, el mismo
día). Al releer el esquema **desplegado** para escribir esta sección —la
misma disciplina del módulo 14, contra lo que corre, no contra el archivo—
`read`/`update` habían vuelto a la forma vieja (el `$and` sin partir), aunque
el archivo del repo ya tenía la forma corregida. La explicación que cuadra con
el resto de este archivo: alguien corrió `npm run deploy:entities` desde una
copia local más vieja que el commit del fix, y `deploy:entities` no necesita
un commit para empujar — sólo el archivo en disco de quien lo corre. Vuelto a
aplicar y confirmado con una lectura fresca e independiente inmediatamente
después (no reutilizando el eco de la propia llamada de escritura).

**Lo que esto enseña, y es la misma lección de "un secreto que nadie ha
releído no está configurado" (módulo 15) aplicada a un esquema:** un fix de
RLS capturado en el repo por el bot no es un fix verificado en producción —
sólo prueba que en algún momento coincidieron. Cualquier `deploy:entities`
posterior desde un checkout desactualizado puede revertirlo sin dejar rastro
en git. La comprobación que hay que repetir no es "¿está en el archivo?" sino
"¿qué devuelve `list_entity_schemas` ahora mismo?".

**Verificado:** `npm run validate:rls` (28 entidades OK) contra el archivo del
repo, que ya coincidía con la forma correcta. Releído el esquema **desplegado**
vía el MCP de Base44 inmediatamente después de la segunda escritura,
independiente del cuerpo que la propia llamada de escritura devolvió: confirma
`read` y `update` con la rama de auto-lectura fuera del `$and`.

**No verificado:** una sesión de navegador real como jose.herrera confirmando
que `DriverProfile.jsx` ya carga — no alcanzable desde este entorno. El riesgo
está acotado porque el cambio reutiliza exactamente la forma ya probada en
`TenantLicense.owner_email` y no toca ninguna otra rama de rol.

## Auditoría incremental (2026-09-10) — el cupo de TODOS los planes valía 5, por un `default` de esquema

Pasada de auditoría rutinaria sobre lo que entró desde la del 2026-09-07. Lo que
había nuevo en `main`: dos funciones que ningún CLAUDE.md menciona
(`aiIntakeTurn`, `extractLogoColors`, del commit «Migrar llamadas sensibles y de
servicio al backend»), la retirada del selector de organización, y el fix de
`Driver.jsonc`. El hallazgo grande no salió de leer código: salió de una captura
de pantalla — la página de Vehículos de Car-Go Rent decía **`10 / 5 en total`**.

### Hallazgo 1 — `max_vehicles`/`max_drivers` tenían `"default": 5` en el esquema

`src/lib/plans.js` documenta el contrato: el cupo de la licencia manda, y
`PLAN_LIMITS` es «el respaldo cuando la licencia no trae el campo». Pero
`TenantLicense.jsonc` le daba `"default": 5` a los dos cupos, y **la plataforma
re-materializa un default de esquema en CADA escritura del registro**. O sea que
el campo nunca podía llegar ausente a `vehicleLimit()`: el fallback por plan era
código muerto y **todo tenant quedaba clavado en 5/5 sin importar su plan**.

Medido contra la base viva, no deducido: los **dos** tenants estaban en 5/5 —
Car-Go Rent con plan `starter` (se le vende 15/20, `$599/mes`) y "Owner" con plan
`enterprise` (debería ser ilimitado). Car-Go Rent ya tenía 10 unidades contra un
tope de 5, así que su owner no podía dar de alta ninguna más.

**Este archivo lo diagnosticó mal dos veces** — el 2026-08-26 y otra vez el
2026-09-10 — como «un override manual suelto», y las dos veces lo «arregló» con
un `$unset` que la siguiente escritura deshacía. La segunda vez llegó a afirmar
por escrito que «no hay código que lo esté re-escribiendo». Lo había: el propio
esquema. La pista estaba a la vista en el `.jsonc` desde siempre; nadie la
comparó contra el comentario de `plans.js` que decía qué se esperaba.

**Arreglo (aplicado y verificado contra producción):**
- `base44/entities/TenantLicense.jsonc` — fuera los dos `"default": 5`. Ausente
  ahora significa de verdad «usa el cupo del plan». La descripción de los dos
  campos empieza con **SIN `default` A PROPÓSITO — no se lo vuelvas a poner** y
  explica el mecanismo, porque el siguiente que edite el esquema no va a leer
  este archivo.
- `src/lib/__tests__/plans.test.js` — guarda nueva que lee el `.jsonc` **de
  disco** y falla si cualquiera de los dos campos vuelve a declarar `default`.
  Comprobada en las dos direcciones: se repuso el default a mano, el test falló,
  se quitó, pasó. Los casos que ya existían («cae al default del plan cuando la
  licencia no trae el cupo») pasaban felices todo este tiempo porque le pasan a
  la función un objeto a mano — **verificaban la función, no el sistema**, que es
  justo el agujero que esta guarda tapa.
- Esquema empujado a producción vía el MCP de Base44 y **releído con una llamada
  independiente** (no el eco de la escritura): los dos `default` ya no están, y
  las 23 propiedades, el `required`, el `rls` de entidad y los once candados
  `write:false` del módulo 1 siguen intactos. Antes de empujar se comparó el
  archivo del repo contra el esquema desplegado campo por campo, para no arrastrar
  deriva ajena en el push — no había ninguna (a diferencia de `Driver.jsonc`).
- Los dos registros vivos quedaron con los campos **ausentes** (`$unset`). Y esta
  vez hay prueba de que aguanta, que es lo que faltaba en los dos intentos
  anteriores: ese mismo update movió `updated_date` y **el default no volvió**.

Cupos efectivos ahora: Car-Go Rent `starter` → 15/20; "Owner" `enterprise` →
ilimitado. **Surte efecto sin `deploy:site`**: el fallback por plan ya vive en el
bundle desplegado, sólo hacía falta que el campo pudiera estar ausente.

**La lección, y es de método:** un `$unset` que no aguanta no es un dato terco,
es un escritor que no has encontrado — y el escritor puede ser el esquema, no
código. Dos pasadas anteriores prefirieron re-aplicar el `$unset` antes que
preguntar por qué volvía. Es la misma forma que el módulo 15 («un secreto que
nadie ha releído no está configurado») y que el `role` del 2026-09-01 («un
`ok:true` prueba que la función terminó, no que escribió»).

### Hallazgo 2 — `extractLogoColors` mandaba a la plataforma a buscar cualquier URL

La función recibe `file_url` del cliente y se lo pasa tal cual a
`asServiceRole.integrations.Core.InvokeLLM({ file_urls: [...] })`. Sin validar
nada: `file://`, `http://localhost`, o el endpoint de metadatos de nube
(`169.254.169.254`) entraban igual, y quien los va a buscar es el fetcher de la
plataforma con rol de servicio.

**Arreglo:** `isPublicHttpUrl()` — sólo `http(s)`, y fuera loopback, rangos
privados, link-local y sufijos `.internal`/`.local`. **Residual dicho y no
tapado:** no detiene un nombre público que resuelva a una IP privada (DNS
rebinding); cerrarlo exige resolver antes o una allowlist de host, y la allowlist
es justo lo que impide el campo «URL del logo» de `TenantEditor.jsx`, que deja
pegar cualquier dirección a mano (hay un tenant con una de Unsplash).

**Lo que NO se hizo, a propósito:** ponerle candado de rol. La función sólo
comprueba `auth.me()`, así que cualquier usuario autenticado la alcanza aunque la
UI viva en Administración — pero `TenantOnboarding.jsx` la llama **antes** de
`createTenant`, cuando quien crea su organización todavía es rol `user` sin
tenant. Gatearla a owner/admin rompería el alta de organizaciones. Mismo criterio
que el módulo 3 aplicó a `LocationRequest`: no se estrena una restricción como
efecto colateral de un arreglo ajeno.

### Hallazgo 3 — `aiIntakeTurn` no acotaba `history`

`forceClose` sólo decide qué se le PIDE al modelo; `conversationBlock`
renderizaba igual **todos** los turnos del cuerpo, y el cuerpo lo controla quien
llama. Una sola petición con 10 000 turnos de 4 000 caracteres se convierte en un
prompt de decenas de millones de caracteres facturado a los créditos de
integración — justo lo que la cabecera de la función dice que se migró al backend
a proteger. Ahora `history` se recorta a `MAX_QUESTIONS` (una entrevista legítima
nunca pasa de 6).

**Residual:** ninguna de las dos funciones tiene límite de frecuencia, así que
cualquier usuario autenticado todavía puede gastar créditos llamándolas en bucle.
El repo ya tiene un patrón para esto (`joinTenant` + la entidad `JoinAttempt`),
pero montarlo aquí es una entidad nueva por función y una decisión de diseño
aparte — se nombra, no se improvisa.

### De paso

- **12 errores de `deno check` preexistentes** en las dos funciones nuevas, todos
  de la misma causa: usan casts JSDoc `/** @type {...} */`, que TypeScript ignora
  en archivos `.ts`, contra el `string | object` que declara `InvokeLLM`.
  Corregidos a casts reales de TS. Las dos compilan limpio ahora. Es exactamente
  lo que este archivo ya predijo del código que llega por el agente externo: su
  primer type-check ocurre al desplegar, porque este repo no corre `deno check`
  en CI.
- **`base44/entities/DebugProbe.jsonc` regresó.** La pasada del 09-07 lo borró
  del repo; el commit `415762d` («External agent changes») lo repuso, porque el
  **esquema nunca se borró del backend** y el reverse-sync lo trae de vuelta.
  Borrarlo otra vez sólo del repo es un no-op ya medido, así que se deja: la API
  de la plataforma no expone borrado de esquemas (`list_api_catalog` → área
  `entities` tiene los 7 verbos de registros, ninguno de esquema). **Hay que
  borrarlo a mano desde el panel de Base44**; hasta entonces `validate:rls`
  cuenta 28 entidades, no 27. Sin riesgo: sin tráfico y con RLS de sólo owner.
- **Las dos suites que este archivo daba por rotas «por un problema de red del
  sandbox» (`permissionsSync.test.js`, `modulePerms.test.js`) pasan.** No era la
  red: era que faltaba `npm install` en el entorno de verificación. Con las
  dependencias puestas corren las 22 suites.

**Verificado:** `npm run lint` (22 endpoints, techo 40), `npm run build`, `npm run
validate:rls` (28 entidades OK), `npm run test -- --run` (482/482, dos nuevas en
`plans.test.js`) — todos limpios. `deno check --node-modules-dir=none` sobre
`extractLogoColors/entry.ts` y `aiIntakeTurn/entry.ts` — las dos limpias. El
esquema y los dos registros, releídos de producción con llamadas independientes.

**No verificado:** una sesión de navegador real de Christian confirmando que
Vehículos ya dice `10 / 15` — no alcanzable desde aquí; el cambio es de datos +
esquema y no depende de `deploy:site`, así que debería bastar con recargar. Y el
deploy de las funciones (`npm run deploy`, módulo 11) para que los tres arreglos
de `extractLogoColors`/`aiIntakeTurn` corran de verdad: hasta entonces el backend
sigue sirviendo las versiones sin validar. El fix del cupo **no** depende de ese
deploy.

### Nota de mecánica: `update_entity_schema` reescribe el `.jsonc` del repo

Empujar el esquema por el MCP no sólo toca el backend: **también escribe la
definición en `base44/entities/<Nombre>.jsonc` y el reverse-sync lo manda a
`main`** — reformateado a la forma canónica de la plataforma (claves en orden
alfabético, unicode escapado, JSON de dos espacios). O sea que un PR que edite un
`.jsonc` a mano Y empuje el esquema **se va a encontrar en conflicto con su propia
base** unos minutos después. Pasó en esta pasada. La resolución correcta es
quedarse con la de `main` (ya trae el cambio, y es la forma que la plataforma va
a reimponer de todos modos) y comprobar que es **equivalente**, no parecida:
23 propiedades, los once `rls.write:false`, `required` y las cuatro ops de `rls`.

## La misma pantalla mentía de cinco formas distintas (2026-09-10, misma sesión)

Salió de una captura de `\/billing` de Car-Go Rent, no de leer código. Las cinco son
la misma clase de defecto: **una copia a mano de algo que ya tenía fuente de verdad**.

1. **`PLAN_FEATURES` (`Billing.jsx`) había derivado de `PLAN_LIMITS`.** Anunciaba
   "Conductores (15)" en Starter y "Conductores (50)" en Pro cuando la app permite
   20 y 75. La página pública de `acaciaco.com.mx` ya anunciaba los correctos
   (5/5, 15/20, 50/75), así que de los tres sitios **el único que mentía era la
   app, al cliente que ya está pagando**. Ahora los cupos salen de `PLAN_LIMITS`.
2. **"-34 días de prueba", en rojo,** en un tenant `starter` al corriente: la
   tarjeta se pintaba con que existiera `trial_ends_at`, sin mirar el plan ni el
   signo. Un `trial_ends_at` no se limpia al pasar a plan pagado.
3. **"Miembros del tenant (0)"** con tres personas en el registro: listaba la
   entidad `User` (cuentas de plataforma, con su propia RLS) en vez de
   `license.members[]`, que es lo que escriben `joinTenant`/`resolveTenant`/
   `InviteForm` y lo que `resolveTenant` lee para reconocer a alguien.
4. **La licencia se leía con un `TenantLicense.list({sort:'-created_date',
   limit:1})[0]` propio de la página.** Dos problemas: depende de que la RLS ya vea
   `{{user.data.tenant_id}}` —la misma lectura que el fix de más arriba quitó de
   `TenantContext.jsx`— y `limit:1` sobre `-created_date` enseña **la más reciente,
   no la tuya**, así que `h.josepablo@gmail.com`, que empareja con dos licencias,
   podía ver aquí la facturación del otro tenant. Acertaba por casualidad de fechas.
   Ahora usa `useTenant()`.
5. **El cupo contaba las bajas.** `Drivers.jsx`/`Vehicles.jsx`/`Billing.jsx` medían
   `rows.length` contra el límite. Car-Go Rent tiene **10 conductores en operación y
   16 `inactive`**, así que la app decía "26 de 20" y **bloqueaba a un cliente que
   está dentro de su plan**, con el mensaje "Mejora tu plan para agregar más".
   Es el más caro de los cinco: por poco se vende un upgrade que no hacía falta.
   `quotaCount()` (`src/lib/plans.js`) es ahora la regla única — `status === 'active'`,
   y sin `status` cuenta como activo, que es el default de la entidad. Los subtítulos
   dicen "N / límite en operación · M en total" para que el cupo y el largo de la
   lista no se contradigan a la vista.

**Car-Go Rent está en el plan correcto** (Starter: 10 de 15 vehículos, 10 de 20
conductores). No hacía falta moverlo; hacía falta que la app contara bien.

### Y un valor que volvió, que NO se volvió a borrar

A las 21:54, veinte minutos después del `$unset` de la sección anterior,
`max_vehicles: 15` / `max_drivers: 20` reaparecieron en Car-Go Rent — no el default
del esquema (ese era 5 y ya no existe), sino los valores exactos de
`PLAN_LIMITS.starter`, escritos explícitamente. El tenant "Owner" no se tocó, así
que fue algo dirigido a ese registro: `SuperAdminPanel.jsx:81` los escribe al
cambiar de plan, y `licensesAdmin`'s `patch` también.

**Se dejaron puestos a propósito.** Hoy coinciden con el plan, así que no cambian
nada; y borrar un valor sin saber quién lo escribió es exactamente el error que
este archivo documenta dos veces más arriba. **La trampa a recordar: son un override
explícito, así que el día que Car-Go Rent suba a Pro seguirá topado en 15/20
hasta que alguien los borre o los actualice.** Si vuelven a aparecer sin que nadie
haya tocado el panel, ahí sí hay un escritor que encontrar.

## Auditoría full-review (2026-09-14) — sin PR/branch/hallazgo previo abierto; 6 de 8 vulnerabilidades de dependencias cerradas

Pasada de auditoría completa programada. Inventario primero: sin PRs abiertos/
draft/stale en `jospabloh/rumbo`, sin ramas de auditoría sueltas, `main` al día
(`ef49b1e`, v1.34.7) con la sesión partiendo del mismo commit. Lo cubierto por
las pasadas anteriores (RLS, aislamiento multi-tenant, permisos granulares, el
patrón `user.data` de `auth.me()`) se releyó contra el código actual en vez de
repetirse desde cero — con fecha de cuatro días desde la última pasada, el
objetivo era detectar regresión, no reabrir lo ya cerrado.

**Regresión: ninguna.** Los 13 archivos de `base44/functions/` que tocan
`user.data` lo hacen sólo en comentarios explicando el fix del 2026-09-03/09-07
— cada uno relee su perfil vía `svc.entities.User.filter({id: user.id})` antes
de derivar `tenant_id`/`write_access`/`driver_profile_id`, nunca de
`auth.me()` directo. `role` se sigue leyendo de `user.role` en todas partes,
como está documentado que debe ser. `npm run validate:rls` (28 entidades) y
`npm run audit:tenant-scope` (guardia de fuga entre tenants) pasan limpios.
`CHANGELOG.md`/`version.js`/`package.json` siguen en sync en 1.34.7. Sin
secretos en el código fuente (grep dirigido sobre `src/`, `base44/`, `api/`
equivalente, `scripts/` — sólo `dist/` generado, ignorado por git, tenía
coincidencias falsas de una librería minificada).

**Hallazgo — `npm audit` no corría nunca desde el A62 de 2026-08 y había vuelto
a acumular 8 vulnerabilidades** (1 baja, 5 moderadas, 2 altas): `fflate`
(transitiva de `jspdf`, dependencia real de producción — usada en la
exportación a PDF), `postcss-selector-parser`/`browserslist`/
`baseline-browser-mapping`/`js-yaml`/`@humanfs/node` (todas transitivas de
herramientas de build/lint, sólo en dev). Ninguna estaba en el CI (`ci.yml`
no corre `npm audit`), así que nadie se habría enterado sin correrlo a mano.

**Arregladas 6 de 8** vía `overrides` en `package.json` (parches/minors dentro
del mismo major, sin tocar ninguna dependencia de nivel superior):
`fflate@^0.8.3`, `js-yaml@^4.3.2`, `browserslist@^4.28.9`,
`postcss-selector-parser@^6.1.4`, `baseline-browser-mapping` (dependencia
directa, `^2.8.32` → `^2.11.23`), `@humanfs/node@^0.16.8`. Verificado con
`npm ls` que las cinco quedaron en la versión objetivo (no sólo "dentro del
rango") y con `npm audit` que las seis salieron del reporte.

**Residual, y por qué no se tocó:** `@vitest/mocker` (vía `vitest@4.1.10`,
severidad moderada, sólo dev — un path traversal en el mock de redirects, que
exige controlar los propios archivos de test para explotarse). No hay versión
fija dentro de la línea 4.x — `4.1.11` existe pero forzarla vía `overrides`
hace que el resolver de npm de este entorno (`10.9.7`) truene con
`Cannot read properties of null (reading 'edgesOut')`, reproducido tres veces
(instalación limpia y sobre lockfile existente, con y sin las otras cinco
overrides puestas) — no es un conflicto real de versiones, es un bug conocido
de arborist con el árbol de peers opcionales de `vitest` (`@vitest/browser-*`,
`msw`). La única fila que sí lo resuelve es `vitest@5.0.0` (mayor), que se
descartó a propósito: es el test runner de las 484 pruebas del repo y un
mayor no se cambia como efecto colateral de un hallazgo de severidad moderada
y sólo-dev. Queda nombrado, no adivinado.

**Sin hallazgos nuevos de RLS, aislamiento de tenant, permisos granulares ni
secretos.** No se abrió ninguna función ni entidad nueva desde el
2026-09-10 que necesitara el mismo escrutinio que `aiIntakeTurn`/
`extractLogoColors` recibieron esa fecha.

**Verificado:** `npm run lint` (22 endpoints), `npm run typecheck`, `npm run
validate:rls` (28 entidades OK), `npm run audit:tenant-scope`, `npm run build`,
`npm run test -- --run` (484/484) — todos limpios, antes y después del cambio
de dependencias. `npm audit`: 8 → 2 vulnerabilidades (ambas la misma cadena
`vitest`/`@vitest/mocker`, dev-only). Sin cambio de RLS ni de esquema — no se
tocó ningún `.jsonc`, así que no aplica `deploy:entities` ni hace falta
`deploy`/`deploy:site` (el cambio no toca `base44/functions/` ni `src/`).

**No verificado:** una sesión de navegador real — no alcanzable desde este
entorno, y este cambio no tiene superficie de UI que probar. Sin bump de
versión: es un cambio interno de dependencias de build/lint más una de
producción usada sólo internamente por una librería ya en uso (`jspdf`), sin
comportamiento nuevo de cara al usuario — misma categoría que los cuatro
precedentes de este archivo sin bump (`494aa29`, `06084e9`/`d07247a`,
`57d4dd2`, `f2aceaf`).

## Auditoría full-review (2026-09-21) — casi nada nuevo que auditar; dos manuales mentían sobre invitaciones y sesiones

Pasada de auditoría completa programada. Inventario primero: sin PRs abiertos/
draft en `jospabloh/rumbo`. La rama `audit/rumbo-full-review` (sin fecha en el
nombre) resultó ser una pieza fósil — su PR #90 está **cerrado**, no fusionado,
y su punta (`v1.30.3`, 2026-08-11) es de más de un mes antes de esta pasada,
sin historia común con `main` (`git merge-base` no encuentra ancestro común:
son dos líneas que divergieron antes de que este repo tuviera el squash/rebase
que las separó). No es "trabajo sin mergear de una pasada anterior de esta
tarea" — es de una tarea distinta, ya cerrada. Se dejó intacta y se abrió esta
pasada en `audit/rumbo-full-review-20260921` en su lugar, para no chocar con
ella ni fingir continuidad que no existe. Las otras cinco ramas con "audit" en
el nombre (`claude/apps-rls-security-audit-xhfvtr`,
`claude/audit-email-reminders-csp5u4`, `claude/rumbo-audit-report-cs0u8j`,
`claude/rumbo-security-audit-sef1x8`, `fix/audit-tenant-scope-self-scope`) son
los mismos leftovers de rama fusionada que el audit v1.30.1 ya catalogó como
"no action required" — confirmado otra vez: cero PRs abiertos las referencian.

**Lo nuevo desde el 2026-09-14: un solo commit, `Update base44 packages`**
(`@base44/vite-plugin` 1.0.36→1.0.37, patch, bot-autor). Ningún archivo de
`base44/functions/`, `base44/entities/` ni `src/` cambió. O sea: no hubo
función ni entidad nueva que auditar por primera vez esta vez — la pasada se
volcó en releer contra la realidad actual, no en analizar diffs.

**Re-verificado, sin hallazgos de regresión:**
- `npm run validate:rls` → 28 entidades OK (27 + `DebugProbe`, que sigue sin
  poderse borrar por API — ver 2026-09-10; su esquema desplegado se releyó de
  nuevo vía el MCP de Base44 y sigue siendo RLS-solo-owner, sin tráfico).
- `npm run audit:tenant-scope` → limpio.
- `npm run lint` (incluye `validate:functions`) → 22 endpoints, techo 40.
- `npm run typecheck`, `npm run build` → limpios.
- `npm run test -- --run` → **484/484**, mismo número exacto que el
  2026-09-14 — cero drift.
- `npm audit` → **2 vulnerabilidades** (la misma cadena
  `vitest@4.1.10`/`@vitest/mocker`, moderada, solo-dev), igual que la última
  vez. `npm audit fix --dry-run` reproduce el mismo error de arborist
  (`Cannot read properties of null (reading 'edgesOut')`) documentado el
  2026-09-14 — confirma que sigue siendo el mismo bloqueo conocido, no uno
  nuevo, y que forzar `vitest@5` sigue siendo la única salida (mayor,
  descartado a propósito, mismo razonamiento).
- Grep de `user\.data\b` sobre las 22 funciones de `base44/functions/` →
  **22 coincidencias, las 22 en comentarios** que documentan el fix del
  09-03/09-07 ("nunca `user.data` de auth.me()"). Ninguna lectura real
  sobreviviente. `manageRole` (que el 09-07 dijo haber incluido) confirmado
  con su propia relectura fresca (`caller.data` de una llamada a
  `svc.entities.User.filter`, no de `auth.me()`). `aiIntakeTurn`/
  `extractLogoColors` (las dos funciones del 09-10, las más nuevas del repo)
  solo llaman `auth.me()` para autenticar, no leen `.data` para decidir un
  write — no les aplica este patrón, confirmado.
- Grep dirigido de secretos (`sk-`, `AKIA`, `BEGIN...PRIVATE KEY`, `xox[baprs]-`,
  `ghp_`, `AIza`, `api_key: "..."`) sobre `src/`, `base44/`, `scripts/` (nunca
  `dist/`) → cero coincidencias.
- Esquema desplegado de `TenantLicense` releído vía el MCP de Base44
  (`list_entity_schemas`, llamada independiente) y comparado campo por campo
  contra el `.jsonc` del repo: los 11 candados `write:false` (los 10 de
  licencia + `owner_email`) siguen ahí, **sin** `default` en `max_vehicles`/
  `max_drivers` (el fix del 2026-09-10 aguanta), `update`/`delete` con la
  misma forma. Sin drift.
- Esquema desplegado de `Driver` releído igual: la rama de auto-lectura del
  conductor (`data.profile_id == {{user.id}}`) sigue **fuera** del `$and` de
  tenant en `read` y `update` — el fix del 2026-09-10 que "se revirtió sola
  una vez" no se ha vuelto a revertir. Comparado también contra el `.jsonc`
  del repo: idénticos, sin la deriva que esa misma sección ya documentó una
  vez.
- `scripts/base44-deploy.mjs` sigue rechazando un `--app-id` por argumento
  (módulo 11) — releído, sin cambios.

**UAT — tres escenarios trazados por código (sin sesión de navegador, igual
que el resto de este archivo):**
1. *Un usuario suspendido no puede escribir.* `manageMember`'s `suspend`
   escribe `data:{suspended:true, write_access:'blocked'}` anidado
   correctamente (patrón del 2026-08-31). `guardedEntityWrite` relee ese
   perfil fresco y rechaza **cualquier** operación sobre las 17 entidades
   module-scoped con 403 `WRITE_BLOCKED` antes de mirar rol o
   `permissions_config` — y `User.write_access` es `rls.write:false`, así que
   el propio usuario no puede desbloquearse por SDK directo. **PASS.**
2. *Un dispatcher al que el admin le negó `Rentas:create` no puede crear un
   `RentCharge`.* `moduleCan()` en `guardedEntityWrite` lee
   `tenant.permissions_config.dispatcher.rentas.create`; un `false` explícito
   devuelve `false` (no cae al default) → 403 `PERMISSION_DENIED`. Los tres
   call sites reales de creación de `RentCharge` (`Rentas.jsx`,
   `ManualChargeModal.jsx`, `QuickIncomeModal.jsx`) usan `guardedCreate`, no
   SDK crudo — grep confirma cero llamadas directas `base44.entities.*` a
   ninguna de las 17 entidades module-scoped en todo `src/`. **PASS** (la RLS
   de entidad seguiría permitiendo la escritura a un dispatcher por un
   `curl`/SDK directo fuera de la app — ese es el gap ya documentado y
   aceptado del módulo 3, no algo nuevo).
3. *Un admin (no el owner) no puede delegar la propiedad del tenant.*
   `delegateOwnership` compara `user.email` (identidad estable de
   `auth.me()`, no contaminable — a diferencia de `.data`) contra el
   `owner_email` **almacenado** del `TenantLicense`, nunca contra
   `user.role`. Un admin con `isAdminOrOwner()==true` pero que no es el
   `owner_email` guardado recibe 403. **PASS.**

**Hallazgo real, cerrado en esta pasada: dos manuales mentían sobre invitar
usuarios y sobre quién puede revocar sesiones.** No era un hallazgo de
seguridad — RLS/funciones ya hacen lo correcto — sino de contenido
desactualizado con potencial de causar soporte real:

- `USER_MANUAL.md` (fecha "Actualizado 2026-08-03", nunca tocado desde
  entonces pese a tres cambios de comportamiento reales) y **el manual que de
  verdad ve un tenant admin dentro de la app**, `src/lib/manual.js` (renderizado
  por `Help.jsx` — más grave que el `.md`, porque a este sí lo lee gente real
  como Christian) decían ambos "Usa Invitar para enviar una invitación por
  correo" — falso desde el 2026-09-10 (`base44.auth.inviteUser nunca acepta la
  sesión de un usuario final`): el flujo ya no manda ningún correo, solo
  agrega al `members[]` y espera que el admin comparta el link de login a
  mano. Un admin siguiendo el manual esperaría un correo que nunca llega.
- Los dos también describían la Zona de Peligro como si delegar/eliminar
  fueran acciones de "Owner, Admin" por igual — desde el módulo 14
  (2026-08-24) son **solo del owner**; un admin ve un aviso en su lugar.
  Ninguno mencionaba "Descargar mis datos" (módulo 7, 2026-08-18) ni
  "Sesiones activas" (módulo 20, 2026-08-27) como secciones de la Zona de
  Peligro — la segunda es la más seria de las dos omisiones:
  `USER_MANUAL.md` afirmaba directamente **"Tenant admins do not have access
  to the active-sessions view — this is a platform-level control only"**,
  que es falso desde hace casi un mes: `DangerZone.jsx` monta
  `ActiveSessions.jsx` para owner Y admin (fuera del `if (isOwner)`),
  self-scoped por `created_by_id`, con botón "Revocar". Documentar mal quién
  puede revocar una sesión es exactamente el tipo de cosa que un módulo 14
  existe para atrapar cuando es código; esta vez era prosa.

**Arreglo:** las tres secciones corregidas en los dos archivos —
`USER_MANUAL.md` (sección Admin + sección Active Sessions, fecha actualizada)
y `src/lib/manual.js` (tópicos "Usuarios e invitaciones" y "Zona de peligro")
— ahora describen exactamente lo que `InviteForm.jsx`/`DangerZone.jsx`/
`ActiveSessions.jsx` hacen hoy: sin correo automático, comparte el link;
exportar y sesiones activas son de owner+admin; delegar y eliminar son solo
del owner. Puramente de contenido — no se tocó ningún `.jsonc`, función ni
componente de lógica, solo texto. `npm run lint`/`typecheck`/`build`/`npm run
test -- --run` (484/484, incluye `manual.test.js`) corridos limpios después
del cambio.

**Sin bump de versión** — mismo criterio que los cinco precedentes de este
archivo (`494aa29`, `06084e9`/`d07247a`, `57d4dd2`, `f2aceaf`, la pasada del
2026-09-14): contenido de documentación, cero cambio de comportamiento en
código, RLS o esquema.

**No verificado:** una sesión de navegador real confirmando que el manual en
`/help` ya muestra el texto corregido tras el próximo `deploy:site`, y una
sesión real de admin/dispatcher/driver de un segundo inquilino para los tres
escenarios UAT de arriba — ninguna alcanzable desde este entorno. El resto de
esta pasada es relectura de código y del esquema desplegado, no ejecución en
vivo.
