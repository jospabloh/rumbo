// Pruebas de comportamiento (no de texto) del flujo de solicitud de unión:
// createTenant / joinTenant / resolveTenant / manageMember contra una base en
// memoria. Correr con:
//   deno test --allow-env --import-map=base44/tests/import_map.json base44/tests/
// (el binario se baja de la release de GitHub; el import de @base44/sdk se
// sustituye por sdk_stub.ts porque npm:/jsr.io están bloqueados en el sandbox).
import { db, reset } from './sdk_stub.ts';

type Handler = (req: Request) => Promise<Response>;
const handlers: Record<string, Handler> = {};

// Captura el handler que cada entry.ts registra con Deno.serve.
async function load(name: string) {
  const realServe = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (h: Handler) => { handlers[name] = h; return { finished: Promise.resolve() }; };
  try {
    await import(`../functions/${name}/entry.ts`);
  } finally {
    // deno-lint-ignore no-explicit-any
    (Deno as any).serve = realServe;
  }
}
for (const n of ['createTenant', 'joinTenant', 'resolveTenant', 'manageMember']) await load(n);

async function call(fn: string, as: string, body: unknown) {
  const res = await handlers[fn](new Request('http://x/', {
    method: 'POST',
    headers: { 'x-test-user': as, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}
const eq = (a: unknown, b: unknown, msg: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const TENANT = { id: 'T1', tenant_name: 'Acme', join_code: 'RUMBO-ABC234', owner_email: 'boss@x.com', status: 'active', members: [{ email: 'boss@x.com', role: 'owner' }] };
const OTHER = { id: 'T2', tenant_name: 'Otra', join_code: 'RUMBO-ZZZ999', owner_email: 'o2@x.com', status: 'active', members: [] };
const seed = () => ({
  TenantLicense: [TENANT, OTHER],
  User: [
    { id: 'boss', email: 'boss@x.com', role: 'owner', data: { tenant_id: 'T1' } },
    { id: 'adm', email: 'adm@x.com', role: 'admin', data: { tenant_id: 'T1' } },
    { id: 'drv', email: 'drv@x.com', role: 'driver', data: { tenant_id: 'T1' } },
    { id: 'new', email: 'new@x.com', role: 'user', full_name: 'Nueva', data: {} },
    { id: 'new2', email: 'new2@x.com', role: 'user', data: {} },
    { id: 'foreign', email: 'f@x.com', role: 'admin', data: { tenant_id: 'T2' } },
  ],
});

Deno.test('unirse con el código deja una solicitud y NO da acceso', async () => {
  reset(seed());
  const r = await call('joinTenant', 'new', { code: 'rumbo-abc234' });
  eq(r.status, 200, 'status');
  eq(r.body.status, 'pending', 'pending');
  const u = db.User.find((x) => x.id === 'new')!;
  assert(!u.data.tenant_id, 'sin tenant_id');
  eq(u.role, 'user', 'rol intacto');
  eq(db.TenantLicense.find((t) => t.id === 'T1')!.members.length, 1, 'members[] intacto');
  eq(db.JoinRequest.length, 1, 'una solicitud');
  eq(db.JoinRequest[0].target_tenant_id, 'T1', 'tenant del código');
  // Idempotente
  await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  eq(db.JoinRequest.length, 1, 'sigue una');
});

Deno.test('resolveTenant refleja la solicitud pendiente y no enlaza tenant', async () => {
  reset(seed());
  await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  const r = await call('resolveTenant', 'new', {});
  eq(r.body.tenant_id, null, 'sin tenant');
  eq(r.body.tenant, undefined, 'sin datos del tenant');
  eq(r.body.join_request.status, 'pending', 'join_request');
  eq(r.body.join_request.tenant_name, 'Acme', 'nombre');
});

Deno.test('con solicitud pendiente no se puede crear otra organización ni pedir otra', async () => {
  reset(seed());
  await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  const c = await call('createTenant', 'new', { tenant_name: 'Mía' });
  eq(c.status, 409, 'createTenant 409');
  eq(db.TenantLicense.length, 2, 'no se creó tenant');
  const j = await call('joinTenant', 'new', { code: 'RUMBO-ZZZ999' });
  eq(j.status, 409, 'segunda solicitud 409');
});

Deno.test('quien ya pertenece a un tenant: 409 al crear y al unirse a otro', async () => {
  reset(seed());
  eq((await call('createTenant', 'drv', { tenant_name: 'Otra más' })).status, 409, 'create');
  eq((await call('joinTenant', 'drv', { code: 'RUMBO-ZZZ999' })).status, 409, 'join');
  eq(db.JoinRequest?.length ?? 0, 0, 'sin solicitud');
});

Deno.test('crear organización: el creador queda owner de SU tenant', async () => {
  reset(seed());
  const r = await call('createTenant', 'new2', { tenant_name: 'Nueva Flota' });
  eq(r.status, 200, 'status');
  const u = db.User.find((x) => x.id === 'new2')!;
  eq(u.data.tenant_id, r.body.tenant_id, 'tenant_id');
  eq(u.role, 'owner', 'owner');
});

Deno.test('invitado por members[] cuenta como pre-aprobado (sin solicitud)', async () => {
  reset(seed());
  db.TenantLicense[0].members.push({ email: 'new@x.com', role: 'dispatcher' });
  const j = await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  eq(j.body.status, 'approved', 'approved');
  eq(db.JoinRequest?.length ?? 0, 0, 'sin solicitud');
  const r = await call('resolveTenant', 'new', {});
  eq(r.body.tenant_id, 'T1', 'enlazado');
  eq(r.body.role, 'dispatcher', 'rol del invitado');
});

Deno.test('aprobar: solo owner/admin del tenant destino, el rol lo elige el admin', async () => {
  reset(seed());
  await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  const id = db.JoinRequest[0].id;

  const list = await call('manageMember', 'adm', { action: 'listRequests' });
  eq(list.body.requests.length, 1, 'admin ve la solicitud');
  eq((await call('manageMember', 'foreign', { action: 'listRequests' })).body.requests.length, 0, 'admin de otro tenant no la ve');
  eq((await call('manageMember', 'drv', { action: 'listRequests' })).status, 403, 'conductor no puede');

  // Admin de OTRO tenant: 404 (igual que inexistente)
  eq((await call('manageMember', 'foreign', { action: 'approveRequest', requestId: id, role: 'admin' })).status, 404, 'ajeno 404');
  // Roles fuera de la lista blanca
  eq((await call('manageMember', 'adm', { action: 'approveRequest', requestId: id, role: 'owner' })).status, 400, 'owner no');
  eq((await call('manageMember', 'adm', { action: 'approveRequest', requestId: id, role: 'root' })).status, 400, 'inventado no');
  eq((await call('manageMember', 'adm', { action: 'approveRequest', requestId: id })).status, 400, 'sin rol no');
  assert(!db.User.find((x) => x.id === 'new')!.data.tenant_id, 'nada se escribió con rechazos');

  const ok = await call('manageMember', 'adm', { action: 'approveRequest', requestId: id, role: 'mechanic' });
  eq(ok.status, 200, 'aprobada');
  const u = db.User.find((x) => x.id === 'new')!;
  eq(u.data.tenant_id, 'T1', 'tenant_id');
  eq(u.role, 'mechanic', 'rol elegido');
  const m = db.TenantLicense.find((t) => t.id === 'T1')!.members.find((x: { email: string }) => x.email === 'new@x.com');
  eq(m.role, 'mechanic', 'members[]');
  eq(db.JoinRequest.length, 0, 'solicitud consumida');
  eq((await call('resolveTenant', 'new', {})).body.tenant_id, 'T1', 'ya entra');
});

Deno.test('rechazar: sin acceso, el solicitante ve el rechazo y puede descartarlo', async () => {
  reset(seed());
  await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  const id = db.JoinRequest[0].id;
  eq((await call('manageMember', 'boss', { action: 'rejectRequest', requestId: id })).status, 200, 'rechazada');
  assert(!db.User.find((x) => x.id === 'new')!.data.tenant_id, 'sin tenant');
  eq((await call('resolveTenant', 'new', {})).body.join_request.status, 'rejected', 've el rechazo');
  // Una rechazada no se puede aprobar después
  eq((await call('manageMember', 'boss', { action: 'approveRequest', requestId: id, role: 'driver' })).status, 409, 'ya resuelta');
  await call('joinTenant', 'new', { action: 'cancel' });
  eq((await call('resolveTenant', 'new', {})).body.join_request, null, 'descartada');
});

Deno.test('aprobar no mueve a quien ya se enganchó a otro tenant', async () => {
  reset(seed());
  await call('joinTenant', 'new', { code: 'RUMBO-ABC234' });
  const id = db.JoinRequest[0].id;
  db.User.find((x) => x.id === 'new')!.data.tenant_id = 'T2';
  const r = await call('manageMember', 'adm', { action: 'approveRequest', requestId: id, role: 'driver' });
  eq(r.status, 409, '409');
  eq(db.User.find((x) => x.id === 'new')!.data.tenant_id, 'T2', 'sigue en T2');
  eq(db.TenantLicense.find((t) => t.id === 'T1')!.members.length, 1, 'members[] intacto');
});

Deno.test('members[].role owner nunca otorga owner (grantableMemberRole sigue)', async () => {
  reset(seed());
  db.TenantLicense[0].members.push({ email: 'new@x.com', role: 'owner' });
  const r = await call('resolveTenant', 'new', {});
  eq(r.body.tenant_id, 'T1', 'enlazado');
  assert(db.User.find((x) => x.id === 'new')!.role !== 'owner', 'no owner');
});

Deno.test('resolveTenant repara el rol owner del creador aunque ya tenga tenant_id', async () => {
  reset(seed());
  // createTenant escribio tenant_id pero su escritura de rol fallo: rol 'user'.
  db.User.find((x) => x.id === 'boss')!.role = 'user';
  const r = await call('resolveTenant', 'boss', {});
  eq(r.body.role, 'owner', 'respuesta owner');
  eq(db.User.find((x) => x.id === 'boss')!.role, 'owner', 'rol persistido');
  // Un admin del tenant NO se sube a owner por esta via.
  await call('resolveTenant', 'adm', {});
  eq(db.User.find((x) => x.id === 'adm')!.role, 'admin', 'admin intacto');
});
