import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GitBranch, GitCommit, Github, FileText, AlertCircle, GitPullRequest, Plus, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function invoke(action, params = {}) {
  return base44.functions.invoke('githubRepos', { action, ...params }).then(r => r.data);
}

export default function GitHubPage() {
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [view, setView] = useState('repos'); // repos | commits | issues | pulls | files
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ghUser, setGhUser] = useState(null);
  const [newIssue, setNewIssue] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([invoke('list_repos'), invoke('get_user')]).then(([r, u]) => {
      setRepos(r.repos || []);
      setGhUser(u.user);
    }).finally(() => setLoading(false));
  }, []);

  const selectRepo = async (repo) => {
    setSelectedRepo(repo);
    setView('commits');
    setItems([]);
    const res = await invoke('list_commits', { owner: repo.owner.login, repo: repo.name });
    setItems(res.commits || []);
  };

  const loadView = async (v) => {
    setView(v);
    setItems([]);
    const { owner: { login }, name } = selectedRepo;
    let res;
    if (v === 'commits') res = await invoke('list_commits', { owner: login, repo: name });
    else if (v === 'issues') res = await invoke('list_issues', { owner: login, repo: name });
    else if (v === 'pulls') res = await invoke('list_pulls', { owner: login, repo: name });
    else if (v === 'files') res = await invoke('list_contents', { owner: login, repo: name });
    setItems(res?.commits || res?.issues || res?.pulls || res?.contents || []);
  };

  const createIssue = async () => {
    if (!newIssue?.title) return;
    setSaving(true);
    const { owner: { login }, name } = selectedRepo;
    await invoke('create_issue', { owner: login, repo: name, title: newIssue.title, body: newIssue.body });
    setNewIssue(null);
    await loadView('issues');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center items-center h-full p-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-5">
        <Github className="w-6 h-6" />
        <div>
          <h1 className="text-xl font-bold">GitHub</h1>
          {ghUser && <p className="text-xs text-muted-foreground">@{ghUser.login} · {repos.length} repos</p>}
        </div>
      </div>

      {!selectedRepo ? (
        <div className="space-y-2">
          {repos.map(repo => (
            <button key={repo.id} onClick={() => selectRepo(repo)}
              className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{repo.full_name}</p>
                {repo.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{repo.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  {repo.language && <span className="text-xs text-muted-foreground">{repo.language}</span>}
                  <span className="text-xs text-muted-foreground">⭐ {repo.stargazers_count}</span>
                  {repo.private && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Privado</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {repos.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Sin repositorios</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSelectedRepo(null)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold">{selectedRepo.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedRepo.full_name}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4 w-fit">
            {[
              { id: 'commits', icon: GitCommit, label: 'Commits' },
              { id: 'issues', icon: AlertCircle, label: 'Issues' },
              { id: 'pulls', icon: GitPullRequest, label: 'PRs' },
              { id: 'files', icon: FileText, label: 'Archivos' },
            ].map(t => (
              <button key={t.id} onClick={() => loadView(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                <t.icon className="w-3.5 h-3.5" />{t.label}
              </button>
            ))}
          </div>

          {/* New issue form */}
          {view === 'issues' && (
            <div className="mb-3">
              {newIssue ? (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2 mb-3">
                  <Input placeholder="Título del issue" value={newIssue.title} onChange={e => setNewIssue(n => ({ ...n, title: e.target.value }))} className="bg-background" />
                  <Input placeholder="Descripción (opcional)" value={newIssue.body || ''} onChange={e => setNewIssue(n => ({ ...n, body: e.target.value }))} className="bg-background" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createIssue} disabled={saving}>{saving ? 'Creando...' : 'Crear Issue'}</Button>
                    <Button size="sm" variant="outline" onClick={() => setNewIssue(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setNewIssue({ title: '', body: '' })} className="gap-1.5 mb-3"><Plus className="w-3.5 h-3.5" />Nuevo Issue</Button>
              )}
            </div>
          )}

          {/* Items list */}
          <div className="space-y-2">
            {items.length === 0 && <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
            {view === 'commits' && items.map(c => (
              <div key={c.sha} className="bg-card border border-border rounded-xl p-3">
                <p className="text-sm font-medium truncate">{c.commit?.message?.split('\n')[0]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.commit?.author?.name} · {c.commit?.author?.date && new Date(c.commit.author.date).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.sha?.slice(0, 7)}</p>
              </div>
            ))}
            {(view === 'issues' || view === 'pulls') && items.map(i => (
              <a key={i.id} href={i.html_url} target="_blank" rel="noopener noreferrer"
                className="bg-card border border-border rounded-xl p-3 flex items-start gap-3 hover:border-primary/40 transition-colors block">
                <span className={`text-xs px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${i.state === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{i.state}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">#{i.number} · {i.user?.login}</p>
                </div>
              </a>
            ))}
            {view === 'files' && items.map(f => (
              <div key={f.path} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <span className="text-lg">{f.type === 'dir' ? '📁' : '📄'}</span>
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  {f.size > 0 && <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}