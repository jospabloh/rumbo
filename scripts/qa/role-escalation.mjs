#!/usr/bin/env node
// QA en vivo de los dos arreglos de PR #130 contra la app DESPLEGADA:
//   1. members[].role = 'owner' no convierte a nadie en owner (resolveTenant).
//   2. Un conductor no puede escribir campos bloqueados de su propio Driver,
//      ni re-atribuirlo a otra persona (guardedEntityWrite).
//
// Crea tres cuentas nuevas (owner, conductor, "cómplice") y un tenant de prueba,
// y lo borra al final con `cleanup`. Contraseñas y tokens viven en QA_STATE
// (por defecto ./.qa-role-escalation.json, ignorado por git): nunca en el repo.
//
//   node scripts/qa/role-escalation.mjs signup <base-email>   # p.ej. you+qa1007@gmail.com
//   node scripts/qa/role-escalation.mjs verify O=123456 D=234567 X=345678
//   node scripts/qa/role-escalation.mjs run
//   node scripts/qa/role-escalation.mjs cleanup
import fs from 'node:fs';
import crypto from 'node:crypto';

const APP_ID = JSON.parse(fs.readFileSync(new URL('../../base44.app.json', import.meta.url))).appId;
const API = `https://base44.app/api/apps/${APP_ID}`;
const STATE = process.env.QA_STATE || '.qa-role-escalation.json';
const ROLES = { O: 'owner', D: 'driver', X: 'accomplice' };

const load = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {});
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2), { mode: 0o600 });

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': APP_ID,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const fn = (name, body, token) => call('POST', `/functions/${name}`, body, token);

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -> ${detail}` : ''}`);
}
const redact = (d) => JSON.stringify(d, (k, v) => (k === 'access_token' ? '[redacted]' : v));
const show = (r) => `${r.status} ${typeof r.data === 'string' ? r.data.slice(0, 160) : redact(r.data).slice(0, 160)}`;

async function signup(base) {
  if (!base || !base.includes('@')) throw new Error('usage: signup <base-email>');
  const [local, domain] = base.split('@');
  const s = { accounts: {} };
  for (const [k, tag] of Object.entries(ROLES)) {
    const email = `${local}${tag}@${domain}`;
    const password = `Qa-${crypto.randomBytes(12).toString('base64url')}9`;
    const r = await call('POST', '/auth/register', { email, password });
    console.log(`${k} ${email}: ${show(r)}`);
    s.accounts[k] = { email, password };
  }
  save(s);
}

async function verify(args) {
  const s = load();
  for (const a of args) {
    const [k, code] = a.split('=');
    const r = await call('POST', '/auth/verify-otp', { email: s.accounts[k].email, otp_code: code });
    console.log(`${k}: ${show(r)}`);
  }
}

async function login(s) {
  for (const [k, acc] of Object.entries(s.accounts)) {
    const r = await call('POST', '/auth/login', { email: acc.email, password: acc.password });
    if (r.status !== 200 || !r.data?.access_token) throw new Error(`login ${k}: ${show(r)}`);
    acc.token = r.data.access_token;
    acc.id = r.data.user?.id;
  }
  save(s);
}

async function run() {
  const s = load();
  await login(s);
  const { O, D, X } = s.accounts;

  // Owner crea su organización.
  if (!s.tenantId) {
    const r = await fn('createTenant', { tenant_name: `QA role escalation ${new Date().toISOString().slice(0, 10)}` }, O.token);
    check('owner crea tenant de prueba', r.status === 200 && r.data?.tenant_id, show(r));
    s.tenantId = r.data?.tenant_id;
    save(s);
    if (!s.tenantId) return;
  }
  await fn('resolveTenant', {}, O.token);

  // Ataque 1: escribir members[] directo por SDK con role 'owner' para el cómplice
  // (la RLS de TenantLicense lo permite a owner/admin) e invitar al conductor.
  const lic = await call('GET', `/entities/TenantLicense/${s.tenantId}`, undefined, O.token);
  const members = (lic.data?.members || []).filter((m) => ![D.email, X.email].includes(m.email));
  members.push({ email: D.email, name: 'QA driver', role: 'driver' });
  members.push({ email: X.email, name: 'QA accomplice', role: 'owner' });
  const put = await call('PUT', `/entities/TenantLicense/${s.tenantId}`, { members }, O.token);
  check('members[] acepta la entrada role:owner por SDK (precondición del ataque)', put.status === 200, show(put));

  const rx = await fn('resolveTenant', {}, X.token);
  check('cómplice queda en el tenant', rx.data?.tenant_id === s.tenantId, show(rx));
  check('cómplice NO recibe role owner de members[]', rx.status === 200 && rx.data?.role !== 'owner', `role=${rx.data?.role}`);
  const xme = await call('GET', '/entities/User/me', undefined, X.token);
  check('perfil guardado del cómplice no es owner', xme.status === 200 && xme.data?.role !== 'owner', `role=${xme.data?.role}`);

  const rd = await fn('resolveTenant', {}, D.token);
  check('conductor invitado recibe role driver', rd.data?.role === 'driver', show(rd));

  // Owner le crea su expediente al conductor; resolveTenant lo enlaza (driver_profile_id).
  if (!s.driverRecordId) {
    const c = await fn('guardedEntityWrite', {
      entity: 'Driver', operation: 'create',
      data: { full_name: 'QA Driver', profile_id: D.id, phone: '4490000000', status: 'active' },
    }, O.token);
    check('owner crea Driver del conductor', c.status === 200 && c.data?.ok, show(c));
    s.driverRecordId = c.data?.record?.id;
    save(s);
  }
  await fn('resolveTenant', {}, D.token);

  // Ataque 2: el conductor edita su propio expediente.
  const upd = (data) => fn('guardedEntityWrite', { entity: 'Driver', operation: 'update', id: s.driverRecordId, data }, D.token);
  const phone = await upd({ phone: '4491112233' });
  check('conductor SÍ puede cambiar su teléfono', phone.status === 200 && phone.data?.ok, show(phone));
  const st = await upd({ status: 'inactive' });
  check('conductor NO puede cambiar status', st.status === 403 && st.data?.code === 'FIELD_LOCKED', show(st));
  const cr = await upd({ referral_credit: 99999 });
  check('conductor NO puede cambiar referral_credit', cr.status === 403 && cr.data?.code === 'FIELD_LOCKED', show(cr));
  const rt = await upd({ profile_id: X.id });
  check('conductor NO puede re-atribuir su expediente', rt.status === 403 && rt.data?.code === 'NOT_YOUR_RECORD', show(rt));

  const after = await call('GET', `/entities/Driver/${s.driverRecordId}`, undefined, O.token);
  check('el registro guardado no cambió status/crédito/dueño',
    after.data?.status === 'active' && !after.data?.referral_credit && after.data?.profile_id === D.id,
    `status=${after.data?.status} credit=${after.data?.referral_credit} profile_id=${after.data?.profile_id === D.id ? 'D' : after.data?.profile_id}`);

  console.log(failures ? `\n${failures} FALLA(S)` : '\nTodo en verde');
  process.exitCode = failures ? 1 : 0;
}

async function cleanup() {
  const s = load();
  await login(s);
  const r = await fn('deleteTenant', {}, s.accounts.O.token);
  console.log(`deleteTenant: ${show(r)}`);
  if (r.status === 200) { delete s.tenantId; delete s.driverRecordId; save(s); }
}

const [cmd, ...args] = process.argv.slice(2);
const cmds = { signup: () => signup(args[0]), verify: () => verify(args), run, cleanup };
if (!cmds[cmd]) { console.error('usage: signup <email> | verify K=code... | run | cleanup'); process.exit(2); }
await cmds[cmd]();
