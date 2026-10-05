import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Esta función es un explorador genérico de datos de Supabase para el dueño de la
// app: la acción `list_tables` descubre dinámicamente las tablas del esquema
// public, así que no existe una lista fija de tablas y no podemos usar un
// allow-list cerrado sin romper el diseño. En su lugar validamos que el nombre de
// tabla sea un identificador SQL válido (letra/underscore inicial), lo que impide
// inyección de path/filtros vía el segmento `table` de la URL de PostgREST.
const TABLE_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
// `select` sólo columnas, comas, paréntesis (embeds), asterisco y espacios.
const SELECT_RE = /^[a-zA-Z0-9_,()* ]+$/;
// `order` = columna opcionalmente seguida de .asc/.desc.
const ORDER_RE = /^[a-zA-Z0-9_]+(\.(asc|desc))?$/;
// Claves de filtro deben ser nombres de columna simples.
const FILTER_KEY_RE = /^[a-zA-Z0-9_]+$/;
// Valores de filtro deben ser un operador PostgREST válido (eq/gt/gte/lt/lte/neq/
// like/ilike/in/is/not) seguido de un valor simple. Sin esto, un valor como
// `col=eq.1&extra_param=...` o `col=` con contenido arbitrario podría inyectar
// parámetros o lógica de consulta adicionales hacia PostgREST.
const FILTER_VALUE_RE = /^(not\.)?(eq|gt|gte|lt|lte|neq|like|ilike|is)\.[a-zA-Z0-9_.@%*+-]{1,200}$|^(not\.)?in\.\([a-zA-Z0-9_,.@%*+-]{1,500}\)$/;
// Tope máximo de filas por lectura para evitar respuestas gigantes.
const MAX_LIMIT = 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const appOwnerEmail = (Deno.env.get('APP_OWNER_EMAIL') || '').toLowerCase();
    if (!appOwnerEmail) return Response.json({ error: 'APP_OWNER_EMAIL no está configurado' }, { status: 403 });
    if ((user.email || '').toLowerCase() !== appOwnerEmail) return Response.json({ error: 'Forbidden: app owner only' }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('supabase');
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    const body = await req.json().catch(() => ({}));
    const { action, table, filters, select, order, limit, offset } = body;

    // Step 1: get projects
    const projRes = await fetch('https://api.supabase.com/v1/projects', { headers: authHeader });
    const projects = await projRes.json();
    if (!projects?.length) return Response.json({ error: 'No Supabase projects found' }, { status: 404 });
    // Asunción: se usa el primer proyecto de la conexión. La app trabaja con un
    // único proyecto Supabase; si hubiera varios, aquí habría que seleccionar por
    // un ref/nombre esperado. No hay un ref esperado disponible en este contexto,
    // así que mantenemos projects[0] (comportamiento previo) de forma explícita.
    const projectRef = projects[0].ref;

    if (action === 'list_projects') {
      return Response.json({ projects });
    }

    if (action === 'list_tables') {
      const schemaRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name" }),
      });
      const schemaData = await schemaRes.json();
      return Response.json({ tables: schemaData, projectRef });
    }

    if (action === 'read_table') {
      // Guard 1: validar el nombre de tabla antes de interpolarlo en la URL, para
      // evitar inyección de path/filtros vía el segmento `table` de PostgREST.
      if (typeof table !== 'string' || !TABLE_RE.test(table)) {
        return Response.json({ error: 'Invalid table name' }, { status: 400 });
      }

      // Guard 2: validar `select` (columnas/embeds) o usar '*' por defecto.
      const selParam = select === undefined || select === null ? '*' : select;
      if (typeof selParam !== 'string' || !SELECT_RE.test(selParam)) {
        return Response.json({ error: 'Invalid select' }, { status: 400 });
      }

      // Guard 3: validar `order` (columna[.asc|.desc]) si viene.
      if (order !== undefined && order !== null && order !== '') {
        if (typeof order !== 'string' || !ORDER_RE.test(order)) {
          return Response.json({ error: 'Invalid order' }, { status: 400 });
        }
      }

      // Guard 4: `limit`/`offset` deben ser enteros no negativos; el límite se
      // recorta a MAX_LIMIT para evitar respuestas gigantes.
      let limitNum: number | null = null;
      if (limit !== undefined && limit !== null && limit !== '') {
        limitNum = Number(limit);
        if (!Number.isInteger(limitNum) || limitNum < 0) {
          return Response.json({ error: 'Invalid limit' }, { status: 400 });
        }
        if (limitNum > MAX_LIMIT) limitNum = MAX_LIMIT;
      }
      let offsetNum: number | null = null;
      if (offset !== undefined && offset !== null && offset !== '') {
        offsetNum = Number(offset);
        if (!Number.isInteger(offsetNum) || offsetNum < 0) {
          return Response.json({ error: 'Invalid offset' }, { status: 400 });
        }
      }

      // Guard 5: filtros — claves deben ser nombres de columna simples Y valores
      // deben calzar con un operador PostgREST válido (eq./gt./in.(...)/etc). Esto
      // impide que un valor arbitrario inyecte parámetros extra de query o lógica
      // de filtro no soportada (p.ej. subconsultas, operadores desconocidos).
      const filterPairs: string[] = [];
      if (filters !== undefined && filters !== null) {
        if (typeof filters !== 'object' || Array.isArray(filters)) {
          return Response.json({ error: 'Invalid filters' }, { status: 400 });
        }
        for (const [col, val] of Object.entries(filters)) {
          if (!FILTER_KEY_RE.test(col)) {
            return Response.json({ error: `Invalid filter key: ${col}` }, { status: 400 });
          }
          const valStr = String(val);
          if (!FILTER_VALUE_RE.test(valStr)) {
            return Response.json({ error: `Invalid filter value for ${col}` }, { status: 400 });
          }
          filterPairs.push(`${col}=${encodeURIComponent(valStr)}`);
        }
      }

      // Get service role key
      const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, { headers: authHeader });
      const keys = await keysRes.json();
      const serviceKey = keys.find((k: { name: string }) => k.name === 'service_role')?.api_key;
      if (!serviceKey) return Response.json({ error: 'Service role key not found' }, { status: 500 });

      const restHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
      let url = `https://${projectRef}.supabase.co/rest/v1/${table}?select=${encodeURIComponent(selParam)}`;
      if (order) url += `&order=${order}`;
      if (limitNum !== null) url += `&limit=${limitNum}`;
      if (offsetNum !== null) url += `&offset=${offsetNum}`;
      for (const pair of filterPairs) url += `&${pair}`;

      const dataRes = await fetch(url, { headers: { ...restHeaders, 'Range-Unit': 'items', Prefer: 'count=exact' } });
      const data = await dataRes.json();
      const total = dataRes.headers.get('Content-Range');
      return Response.json({ data, total, projectRef, table });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});