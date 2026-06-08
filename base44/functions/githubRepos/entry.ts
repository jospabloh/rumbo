import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'owner'].includes(user.role)) return Response.json({ error: 'Forbidden: Admin or Owner access required' }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const body = await req.json().catch(() => ({}));
    const { action, owner, repo, path, sha, content, message, branch } = body;

    if (action === 'list_repos') {
      const res = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', { headers });
      const data = await res.json();
      return Response.json({ repos: data });
    }

    if (action === 'get_repo') {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      const data = await res.json();
      return Response.json({ repo: data });
    }

    if (action === 'list_branches') {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
      const data = await res.json();
      return Response.json({ branches: data });
    }

    if (action === 'list_commits') {
      const branchParam = branch ? `?sha=${branch}&per_page=30` : '?per_page=30';
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits${branchParam}`, { headers });
      const data = await res.json();
      return Response.json({ commits: data });
    }

    if (action === 'list_contents') {
      const pathParam = path ? `/${path}` : '';
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents${pathParam}`, { headers });
      const data = await res.json();
      return Response.json({ contents: data });
    }

    if (action === 'get_file') {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
      const data = await res.json();
      const decoded = data.encoding === 'base64' ? atob(data.content.replace(/\n/g, '')) : data.content;
      return Response.json({ file: data, decoded });
    }

    if (action === 'list_issues') {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=30`, { headers });
      const data = await res.json();
      return Response.json({ issues: data });
    }

    if (action === 'create_issue') {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: body.title, body: body.body, labels: body.labels }),
      });
      const data = await res.json();
      return Response.json({ issue: data });
    }

    if (action === 'list_pulls') {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=30`, { headers });
      const data = await res.json();
      return Response.json({ pulls: data });
    }

    if (action === 'get_user') {
      const res = await fetch('https://api.github.com/user', { headers });
      const data = await res.json();
      return Response.json({ user: data });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});