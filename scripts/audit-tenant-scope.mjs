#!/usr/bin/env node
/**
 * audit-tenant-scope.mjs — guard against cross-tenant RLS leaks.
 *
 * Complementa a validate-rls.mjs. Aquel verifica las dos fallas SILENCIOSAS de
 * sintaxis (rutas `data.*` y templates `{{user.data.*}}`). Este verifica la falla
 * SEMÁNTICA que ya nos mordió dos veces (TenantLicense y SupportTicket): una regla
 * de acceso con una rama que NO está acotada por tenant — típicamente un
 * `{"user_condition":{"role":"admin"}}` suelto — que deja a cualquier admin de un
 * tenant leer/editar los datos de OTROS tenants.
 *
 * Regla:
 *   - Para read/update/delete de toda entidad multi-tenant (tiene `tenant_id`, o es
 *     TenantLicense cuyo id ES el tenant): CADA rama debe acotar por tenant
 *     (`data.tenant_id == {{user.data.tenant_id}}`) o por un ámbito PROPIO
 *     globalmente único del usuario (su id, su email como owner/miembro, su ticket,
 *     su perfil de conductor). Una rama de solo-rol sin acotar = fuga → falla.
 *   - Para `create`: solo se exige si `tenant_id` es escribible por el cliente. Si
 *     `tenant_id` es server-authoritative (`rls.write:false`) o no existe (la
 *     entidad ES el tenant), el cliente no puede falsificarlo, así que crear con un
 *     rol no es una fuga cross-tenant (creación de identidad: User, TenantLicense).
 *
 * El cruce cross-tenant real del platform owner se hace por funciones service-role
 * (ticketsAdmin, licensesAdmin), no por estas RLS de rol.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ENTITIES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'base44', 'entities');

function parseJsonc(text) {
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'));
}

// Ámbitos propios globalmente únicos que aíslan aun sin data.tenant_id.
const SELF_SCOPES = [
  '"id":"{{user.id}}"',
  'data.owner_email":"{{user.email}}"',
  'data.members.email":"{{user.email}}"',
  'data.requester_id":"{{user.id}}"',
  'data.profile_id":"{{user.id}}"',
  'data.driver_id":"{{user.data.driver_profile_id}}"',
  'data.assigned_driver_id":"{{user.data.driver_profile_id}}"',
  'data.channel_driver_id":"{{user.data.driver_profile_id}}"',
  'data.requested_by":"{{user.id}}"',
  'data.sender_id":"{{user.id}}"',
  'created_by_id":"{{user.id}}"',
  'data.channel_kind":"broadcast"', // canal de difusión: visible a todo el tenant (ya acotado por el tenant_id del propio mensaje)
];
const TENANT = 'data.tenant_id":"{{user.data.tenant_id}}"';
const branchScoped = (s) => s.includes(TENANT) || SELF_SCOPES.some((k) => s.includes(k));

const errors = [];
for (const file of readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.jsonc'))) {
  const schema = parseJsonc(readFileSync(join(ENTITIES_DIR, file), 'utf8'));
  const tenantField = schema.properties?.tenant_id;
  const isTenantScoped = !!tenantField || schema.name === 'TenantLicense';
  if (!isTenantScoped) continue;
  // ¿tenant_id lo puede escribir el cliente? (si no existe o es write:false, no.)
  const tenantClientWritable = !!tenantField && tenantField?.rls?.write !== false;

  for (const op of ['create', 'read', 'update', 'delete']) {
    if (op === 'create' && !tenantClientWritable) continue; // creación de identidad: exenta
    const rule = schema.rls?.[op];
    if (!rule) continue;
    if (typeof rule === 'object' && 'data.tenant_id' in rule) continue; // tenant a nivel superior (AND) → seguro
    const branches = Array.isArray(rule.$or) ? rule.$or : [rule];
    for (const b of branches) {
      const s = JSON.stringify(b);
      if (!branchScoped(s)) {
        errors.push(`${file}: rls.${op} tiene una rama SIN acotar por tenant → ${s}. Debe incluir data.tenant_id o un ámbito propio; el acceso cross-tenant del platform owner va por funciones service-role.`);
      }
    }
  }
}

if (errors.length) {
  console.error(`\n❌ audit:tenant-scope encontró ${errors.length} posible(s) fuga(s) cross-tenant:`);
  for (const e of errors) console.error(`   • ${e}`);
  process.exit(1);
}
console.log('✅ audit:tenant-scope — todas las reglas read/update/delete (y create escribible) están acotadas por tenant.');
