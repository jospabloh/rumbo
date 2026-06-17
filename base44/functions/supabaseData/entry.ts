import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
      // Get service role key
      const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, { headers: authHeader });
      const keys = await keysRes.json();
      const serviceKey = keys.find(k => k.name === 'service_role')?.api_key;
      if (!serviceKey) return Response.json({ error: 'Service role key not found' }, { status: 500 });

      const restHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
      const selParam = select || '*';
      let url = `https://${projectRef}.supabase.co/rest/v1/${table}?select=${selParam}`;
      if (order) url += `&order=${order}`;
      if (limit) url += `&limit=${limit}`;
      if (offset) url += `&offset=${offset}`;
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          url += `&${col}=${val}`;
        }
      }

      const dataRes = await fetch(url, { headers: { ...restHeaders, 'Range-Unit': 'items', Prefer: 'count=exact' } });
      const data = await dataRes.json();
      const total = dataRes.headers.get('Content-Range');
      return Response.json({ data, total, projectRef, table });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});