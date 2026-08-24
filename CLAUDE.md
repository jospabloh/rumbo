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
el maestro hasta que las nueve apps acepten derivada. Falta el paso que cierra
el agujero de verdad: poner `ACCEPT_LEGACY_MASTER` en `false` en todas partes y
cambiar la firma de salida de MC a `signFor`. Mientras tanto una firma con el
maestro se sigue aceptando. `ACACIA_APP_SLUG` ya estaba puesto aquí.

**Corrección del 2026-08-24: ese `ya estaba puesto` nunca se comprobó, y no
sirve.** En la sincronización de las nueve apps de ese día, Mission Control
registró que **rumbo rechazó la llave derivada y aceptó el maestro** — junto con
las otras tres que tampoco pasaron (las cuatro son justo las que traían el
secreto de antes; las cinco a las que se les puso ese día verificaron derivada a
la primera). O sea: aquí hay un `ACACIA_APP_SLUG`, pero la llave que sale de él
no es la que Mission Control calcula.

Dos causas posibles, y desde Mission Control no se distinguen porque no puede
leer los secrets de una app de Base44:

1. **el valor no es exactamente `rumbo`** — tiene que ser el id de Mission
   Control, en minúsculas, sin espacios ni sufijos;
2. **el `acaciaControl` desplegado es anterior a `_acaciaSign.ts`** y sólo sabe
   verificar con el maestro. `npm run deploy` lo descarta.

Hasta que una sincronización complete sin esa advertencia, el flag se queda en
`true` y el respaldo de Mission Control es lo único que mantiene vivo el puente
de esta app.

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
