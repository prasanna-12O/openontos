import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Database, PlugZap, CheckCircle2, XCircle, Loader2, Plus, Trash2, RefreshCw, Server, Cloud, FileSpreadsheet, HardDrive, Warehouse, Globe, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { DataSource, DataSourceType } from '@/types/project';
import { type LucideIcon } from 'lucide-react';
import SampleDataDialog from './SampleDataDialog';
import { useAutoFlow } from '@/hooks/useAutoFlow';

interface SourceTypeMeta {
  label: string;
  color: string;
  icon: LucideIcon;
  category: 'database' | 'cloud' | 'file' | 'api';
}

const SOURCE_TYPE_META: Record<DataSourceType, SourceTypeMeta> = {
  postgresql:        { label: 'PostgreSQL',        color: 'text-blue-400',   icon: Server,          category: 'database' },
  mysql:             { label: 'MySQL',             color: 'text-orange-400', icon: Server,          category: 'database' },
  sqlserver:         { label: 'SQL Server',        color: 'text-red-400',    icon: Server,          category: 'database' },
  oracle:            { label: 'Oracle',            color: 'text-red-500',    icon: Server,          category: 'database' },
  mongodb:           { label: 'MongoDB',           color: 'text-green-500',  icon: Server,          category: 'database' },
  snowflake:         { label: 'Snowflake',         color: 'text-cyan-400',   icon: Cloud,           category: 'cloud' },
  bigquery:          { label: 'BigQuery',          color: 'text-blue-300',   icon: Cloud,           category: 'cloud' },
  redshift:          { label: 'Redshift',          color: 'text-purple-400', icon: Cloud,           category: 'cloud' },
  databricks:        { label: 'Databricks',        color: 'text-orange-500', icon: Cloud,           category: 'cloud' },
  fabric_lakehouse:  { label: 'Fabric Lakehouse',  color: 'text-teal-400',   icon: Warehouse,       category: 'cloud' },
  fabric_warehouse:  { label: 'Fabric Warehouse',  color: 'text-teal-500',   icon: Warehouse,       category: 'cloud' },
  csv:               { label: 'CSV File',          color: 'text-green-400',  icon: FileSpreadsheet, category: 'file' },
  s3:                { label: 'AWS S3',            color: 'text-yellow-400', icon: HardDrive,       category: 'file' },
  azure_blob:        { label: 'Azure Blob',        color: 'text-blue-500',   icon: HardDrive,       category: 'file' },
  api:               { label: 'REST API',          color: 'text-violet-400', icon: Globe,           category: 'api' },
};

const CATEGORY_LABELS: Record<string, string> = {
  database: 'Databases',
  cloud: 'Cloud Warehouses',
  file: 'Files & Storage',
  api: 'APIs',
};

const StatusBadge = ({ status, errorMessage }: { status: DataSource['status']; errorMessage?: string }) => {
  if (status === 'connected') return (
    <span className="flex items-center gap-1.5 text-[11px] text-success font-mono">
      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
    </span>
  );
  if (status === 'testing') return (
    <span className="flex items-center gap-1.5 text-[11px] text-primary font-mono">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing...
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1.5 text-[11px] text-destructive font-mono" title={errorMessage}>
      <XCircle className="w-3.5 h-3.5" /> Error
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
      <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40" /> Disconnected
    </span>
  );
};

export default function DataSourcesModule() {
  const { getActiveProject, removeDataSource, testDataSource, toggleAgentPanel, openAgentWithPrompt } = useAppStore();
  const project = getActiveProject();
  const [viewSourceId, setViewSourceId] = useState<string | null>(null);
  const { runForSource } = useAutoFlow();

  // Test connection then, on success with discovered tables, automatically
  // profile every table and generate the ontology — single-click flow.
  const testAndAutoFlow = async (id: string) => {
    await testDataSource(id);
    const latest = useAppStore.getState();
    const proj = latest.projects.find(p => p.id === latest.activeProjectId);
    const ds = proj?.dataSources.find(d => d.id === id);
    if (ds && ds.status === 'connected' && (ds.tables?.length || 0) > 0) {
      // Fire and forget — autoflow drives its own toast.
      void runForSource(id);
    }
  };

  if (!project) return null;
  const sources = project.dataSources || [];
  const viewSource = sources.find(s => s.id === viewSourceId) || null;

  const groupedTypes = (['database', 'cloud', 'file', 'api'] as const).map(cat => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    types: (Object.entries(SOURCE_TYPE_META) as [DataSourceType, SourceTypeMeta][]).filter(([, m]) => m.category === cat),
  }));

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <PlugZap className="w-5 h-5 text-primary" />
              Data Sources
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Manage connections to databases, file stores, and APIs
            </p>
          </div>
          <button
            onClick={() => {
              toggleAgentPanel();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium glow-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Source via Agent
          </button>
        </div>

        {/* Supported sources grid — always visible */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supported Sources</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {groupedTypes.map(group => (
              <div key={group.category} className="space-y-2">
                <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">{group.label}</span>
                <div className="space-y-1 group">
                  {group.types.map(([typeId, meta]) => {
                    const Icon = meta.icon;
                    const isConnected = sources.some(s => s.type === typeId && s.status === 'connected');
                    return (
                      <button
                        key={typeId}
                        onClick={() => openAgentWithPrompt(`Add a ${meta.label} source`)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors w-full text-left cursor-pointer',
                          isConnected
                            ? 'border-success/30 bg-success/5'
                            : 'border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card'
                        )}
                      >
                        <Icon className={cn('w-4 h-4 shrink-0', meta.color)} />
                        <span className="text-xs font-medium truncate">{meta.label}</span>
                        {isConnected && <CheckCircle2 className="w-3 h-3 text-success ml-auto shrink-0" />}
                        {!isConnected && <Plus className="w-3 h-3 text-muted-foreground/40 ml-auto shrink-0 opacity-0 group-hover:opacity-100" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {sources.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-dashed border-border rounded-xl p-8 text-center"
          >
            <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No data sources connected yet</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
              Use the AI Agent to connect any of the sources above.
            </p>
            <button
              onClick={toggleAgentPanel}
              className="text-xs px-4 py-2 rounded-lg bg-agent/15 text-agent hover:bg-agent/25 transition-colors"
            >
              Open AI Agent
            </button>
          </motion.div>
        )}

        {/* Source cards */}
        <div className="grid gap-3">
          <AnimatePresence>
            {sources.map((src, i) => {
              const meta = SOURCE_TYPE_META[src.type] || { label: src.type, color: 'text-muted-foreground', icon: Database, category: 'database' as const };
              const SrcIcon = meta.icon;
              return (
                <motion.div
                  key={src.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 group hover:border-primary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                    <SrcIcon className={cn("w-5 h-5", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{src.name}</span>
                      <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted", meta.color)}>
                        {meta.label}
                      </span>
                    </div>
                    {src.lastTested && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Last tested: {new Date(src.lastTested).toLocaleString()}
                      </p>
                    )}
                    {src.errorMessage && (
                      <p className="text-[10px] text-destructive mt-0.5 truncate">{src.errorMessage}</p>
                    )}
                    {src.tables && src.tables.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {src.tables.length} table{src.tables.length !== 1 ? 's' : ''} discovered
                      </p>
                    )}
                  </div>
                  <StatusBadge status={src.status} errorMessage={src.errorMessage} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {src.status === 'connected' && src.tables && src.tables.length > 0 && (
                      <button
                        onClick={() => setViewSourceId(src.id)}
                        className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        title="View sample data"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-mono">View</span>
                      </button>
                    )}
                    <button
                      onClick={() => testAndAutoFlow(src.id)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Test connection & auto-build ontology"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeDataSource(src.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove source"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <SampleDataDialog
        source={viewSource}
        open={!!viewSource}
        onClose={() => setViewSourceId(null)}
      />
    </div>
  );
}
