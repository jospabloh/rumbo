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
