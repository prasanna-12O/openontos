import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Database, FileSpreadsheet, Table as TableIcon, Loader2, AlertCircle, Eye } from 'lucide-react';
import type { DataSource } from '@/types/project';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface SampleDataDialogProps {
  source: DataSource | null;
  open: boolean;
  onClose: () => void;
}

interface SampleResult {
  supported: boolean;
  columns: string[];
  rows: unknown[][];
  error?: string;
  reason?: string;
}

export default function SampleDataDialog({ source, open, onClose }: SampleDataDialogProps) {
  const tables = useMemo(() => source?.tables || [], [source]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SampleResult | null>(null);

  const activeTable = selectedTable || tables[0] || null;

  // Reset selection when source changes
  useEffect(() => {
    if (source) setSelectedTable(null);
  }, [source?.id]);

  // Fetch real sample data when active table changes
  useEffect(() => {
    if (!source || !activeTable || !open) return;
    let cancelled = false;
    setLoading(true);
    setResult(null);
    supabase.functions
      .invoke('fetch-source-sample', {
        body: {
          sourceType: source.type,
          table: activeTable,
          connectionParams: source.connectionParams || {},
          limit: 25,
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setResult({ supported: true, columns: [], rows: [], error: error.message });
        } else {
          setResult(data as SampleResult);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [source?.id, activeTable, open]);

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-primary" />
            {source.name}
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-1">
              {source.type}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Live data preview · {tables.length} table{tables.length === 1 ? '' : 's'} discovered
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          {/* Table list sidebar */}
          <div className="w-60 shrink-0 border-r border-border overflow-y-auto scrollbar-thin bg-muted/20">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Tables / Files
            </div>
            {tables.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No tables discovered yet.</p>
            ) : (
              tables.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTable(t)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs font-mono break-all flex items-start gap-2 border-l-2 transition-colors',
                    activeTable === t
                      ? 'bg-primary/10 text-primary border-primary'
                      : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  )}
                  title={t}
                >
                  {t.includes('/') ? (
                    <FileSpreadsheet className="w-3 h-3 mt-0.5 shrink-0" />
                  ) : (
                    <TableIcon className="w-3 h-3 mt-0.5 shrink-0" />
                  )}
                  <span className="truncate">{t.split('/').pop() || t}</span>
                </button>
              ))
            )}
          </div>

          {/* Sample data panel */}
          <div className="flex-1 overflow-auto scrollbar-thin">
            {!activeTable ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Select a table to preview live data.
              </div>
            ) : loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                Fetching live sample from <code className="font-mono">{source.type}</code>…
              </div>
            ) : result && !result.supported ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
                <Eye className="w-8 h-8 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium text-foreground">Live preview not supported</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    {result.reason || `Live preview is not available for ${source.type} sources.`}
                  </p>
                </div>
              </div>
            ) : result?.error ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
                <AlertCircle className="w-8 h-8 text-destructive/60" />
                <div>
                  <p className="text-sm font-medium text-foreground">Could not fetch data</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md font-mono break-all">{result.error}</p>
                </div>
              </div>
            ) : result && result.rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <p>No rows returned from <code className="font-mono">{activeTable}</code>.</p>
              </div>
            ) : result ? (
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <code className="text-[11px] font-mono text-foreground/80 break-all">{activeTable}</code>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-3">
                    {result.rows.length} rows · {result.columns.length} cols · live
                  </span>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        {result.columns.map((c) => (
                          <th key={c} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 font-mono text-[11px] text-foreground/85 whitespace-nowrap max-w-xs truncate" title={String(cell)}>
                              {cell == null ? <span className="text-muted-foreground/50 italic">null</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
