// Doble en memoria de @base44/sdk para probar las funciones de servidor SIN red
// (deno.land/jsr.io/npm están bloqueados en el sandbox). Solo implementa lo que
// usan joinTenant / manageMember / createTenant / resolveTenant: entidades con
// get / filter (igualdad y $lt) / list / create / update / delete, y auth.me().
// La sesión de la petición se pasa en la cabecera `x-test-user` (id del User).

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export const db: Record<string, Row[]> = {};
let seq = 0;

export function reset(seed: Record<string, Row[]> = {}) {
  for (const k of Object.keys(db)) delete db[k];
  for (const [k, rows] of Object.entries(seed)) db[k] = rows.map((r) => structuredClone(r));
  seq = 0;
}

function match(row: Row, q: Row): boolean {
  return Object.entries(q).every(([k, v]) => {
    if (v && typeof v === 'object' && '$lt' in v) return row[k] < v.$lt;
    return row[k] === v;
  });
}

function entity(name: string) {
  const rows = () => (db[name] ??= []);
  return {
    get: (id: string) => {
      const r = rows().find((x) => x.id === id);
      return r ? Promise.resolve(structuredClone(r)) : Promise.reject(new Error('not found'));
    },
    filter: (q: Row = {}) => Promise.resolve(rows().filter((r) => match(r, q)).map((r) => structuredClone(r))),
    list: () => Promise.resolve(rows().map((r) => structuredClone(r))),
    create: (data: Row) => {
      const r = { id: `${name}_${++seq}`, ...structuredClone(data) };
      rows().push(r);
      return Promise.resolve(structuredClone(r));
    },
    // Como la plataforma: el patch reemplaza las claves de primer nivel que trae.
    update: (id: string, patch: Row) => {
      const r = rows().find((x) => x.id === id);
      if (!r) return Promise.reject(new Error('not found'));
      Object.assign(r, structuredClone(patch));
      return Promise.resolve(structuredClone(r));
    },
    delete: (id: string) => {
      db[name] = rows().filter((x) => x.id !== id);
      return Promise.resolve();
    },
  };
}

export function createClientFromRequest(req: Request) {
  const uid = req.headers.get('x-test-user');
  const entities = new Proxy({}, { get: (_t, name: string) => entity(name) });
  return {
    auth: {
      me: () => {
        const u = (db.User ?? []).find((x) => x.id === uid);
        // Como auth.me(): sesión (id, email, role) — la lectura autoritativa de
        // `data` la hacen las funciones por service role.
        return Promise.resolve(u ? structuredClone(u) : null);
      },
    },
    asServiceRole: { entities },
  };
}
