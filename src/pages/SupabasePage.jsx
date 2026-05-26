import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Database, Table, ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function invoke(action, params = {}) {
  return base44.functions.invoke('supabaseData', { action, ...params }).then(r => r.data);
}

export default function SupabasePage() {
  const [projects, setProjects] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    Promise.all([invoke('list_projects'), invoke('list_tables')]).then(([p, t]) => {
      setProjects(p.projects || []);
      const tableNames = (t.tables || []).map(r => r.table_name).filter(Boolean);
      setTables(tableNames);
    }).finally(() => setLoading(false));
  }, []);

  const loadTable = async (tableName, pageNum = 0) => {
    setSelectedTable(tableName);
    setLoadingRows(true);
    setPage(pageNum);
    const res = await invoke('read_table', { table: tableName, limit: PAGE_SIZE, offset: pageNum * PAGE_SIZE });
    const data = res.data || [];
    if (data.length > 0) setColumns(Object.keys(data[0]));
    setRows(data);
    setTotal(res.total);
    setLoadingRows(false);
  };

  if (loading) return <div className="flex justify-center items-center h-full p-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-5">
        <Database className="w-6 h-6 text-success" />
        <div>
          <h1 className="text-xl font-bold">Supabase</h1>
          {projects[0] && <p className="text-xs text-muted-foreground">Proyecto: {projects[0].name} · {tables.length} tablas</p>}
        </div>
      </div>

      {!selectedTable ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">Tablas disponibles en el esquema público:</p>
          {tables.map(t => (
            <button key={t} onClick={() => loadTable(t)}
              className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left">
              <Table className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm flex-1">{t}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
          {tables.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Sin tablas en el esquema público</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setSelectedTable(null); setRows([]); setColumns([]); }}
              className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="font-bold">{selectedTable}</h2>
              {total && <p className="text-xs text-muted-foreground">{total}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => loadTable(selectedTable, page)} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Actualizar
            </Button>
          </div>

          {loadingRows ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              {rows.length > 0 ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted border-b border-border">
                          {columns.map(col => (
                            <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            {columns.map(col => (
                              <td key={col} className="px-3 py-2 max-w-[180px] truncate text-muted-foreground">
                                {row[col] === null ? <span className="text-muted-foreground/40 italic">null</span>
                                  : typeof row[col] === 'object' ? JSON.stringify(row[col]).slice(0, 60) + '…'
                                  : String(row[col]).slice(0, 80)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Página {page + 1} · {rows.length} filas</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => loadTable(selectedTable, page - 1)}>Anterior</Button>
                      <Button size="sm" variant="outline" disabled={rows.length < PAGE_SIZE} onClick={() => loadTable(selectedTable, page + 1)}>Siguiente</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos en esta tabla</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}