import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Upload, Table, ChevronDown, ChevronRight, AlertTriangle, Key, BarChart3, Search, Database, PlugZap, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { TableSchema, ColumnProfile, DataSource } from '@/types/project';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { v4 as uuid } from 'uuid';
import { useLLM } from '@/hooks/useLLM';
import { supabase } from '@/integrations/supabase/client';

const SOURCE_TYPE_COLORS: Record<string, string> = {
  postgresql: 'text-blue-400',
  mysql: 'text-orange-400',
  snowflake: 'text-cyan-400',
  bigquery: 'text-blue-300',
  csv: 'text-green-400',
  api: 'text-violet-400',
};

interface SourceSampleResult {
  supported: boolean;
  columns: string[];
  rows: unknown[][];
  error?: string;
  reason?: string;
}

const stringifyCell = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const inferDatatype = (values: string[]): string => {
  if (!values.length) return 'VARCHAR';

  const normalized = values.map((value) => value.trim()).filter(Boolean);
  if (!normalized.length) return 'VARCHAR';

  const isBoolean = normalized.every((value) => /^(true|false)$/i.test(value));
  if (isBoolean) return 'BOOLEAN';

  const isInteger = normalized.every((value) => /^-?\d+$/.test(value));
  if (isInteger) return 'INTEGER';

  const isDecimal = normalized.every((value) => /^-?\d+(\.\d+)?$/.test(value));
  if (isDecimal) return 'DECIMAL';

  const isTimestamp = normalized.every((value) => !Number.isNaN(Date.parse(value)));
  if (isTimestamp) return 'TIMESTAMP';

  return 'VARCHAR';
};

const buildColumnProfiles = (sample: SourceSampleResult): ColumnProfile[] => {
  return sample.columns.map((columnName, index) => {
    const rawValues = sample.rows.map((row) => row[index]);
    const values = rawValues.map(stringifyCell);
    const nonEmptyValues = values.filter((value) => value.trim() !== '');
    const nullCount = values.length - nonEmptyValues.length;
    const uniqueCount = new Set(nonEmptyValues).size;
    const nullPercent = Math.round((nullCount / Math.max(values.length, 1)) * 1000) / 10;
    const uniquePercent = Math.round((uniqueCount / Math.max(nonEmptyValues.length, 1)) * 1000) / 10;
    const anomalies: string[] = [];

    if (nullPercent >= 10) {
      anomalies.push(`${nullPercent}% null rate in sample`);
    }

    return {
      name: columnName,
      datatype: inferDatatype(nonEmptyValues),
      nullPercent,
      uniquePercent,
      sampleValues: nonEmptyValues.slice(0, 3),
      isKey: nonEmptyValues.length > 0 && uniqueCount === nonEmptyValues.length && nullCount === 0,
      anomalies: anomalies.length ? anomalies : undefined,
    };
  });
};

const getImportedTableName = (tableName: string, sourceType: DataSource['type']): string => {
  if (sourceType === 'azure_blob' || sourceType === 's3' || sourceType === 'csv') {
    return tableName.split('/').pop() || tableName;
  }

  return tableName;
};

export default function ProfileModule() {
  const { getActiveProject, addTable, updateTable, testDataSource } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('profile');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importingFrom, setImportingFrom] = useState<string | null>(null);
  const [reprofilingTable, setReprofilingTable] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [generatingDescs, setGeneratingDescs] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        preview: 200,
        complete: (results) => {
          if (!results.meta.fields) return;
          const data = results.data as Record<string, string>[];
          const columns: ColumnProfile[] = results.meta.fields.map((field) => {
            const values = data.map(r => r[field]);
            const nullCount = values.filter(v => !v || v === '').length;
            const nonNull = values.filter(v => v && v !== '');
            const uniqueCount = new Set(nonNull).size;
            const isNum = nonNull.length > 0 && nonNull.every(v => !isNaN(Number(v)));
            const isDate = nonNull.length > 0 && nonNull.slice(0, 10).every(v => !isNaN(Date.parse(v)));
            const hasDot = nonNull.some(v => v.includes('.'));
            return {
              name: field,
              datatype: isNum ? (hasDot ? 'DECIMAL' : 'INTEGER') : isDate ? 'TIMESTAMP' : 'VARCHAR',
              nullPercent: Math.round((nullCount / Math.max(values.length, 1)) * 1000) / 10,
              uniquePercent: Math.round((uniqueCount / Math.max(nonNull.length, 1)) * 1000) / 10,
              sampleValues: nonNull.slice(0, 3),
              isKey: uniqueCount === nonNull.length && nonNull.length > 0,
              anomalies: nullCount > values.length * 0.1 ? [`${Math.round((nullCount / values.length) * 100)}% null rate`] : undefined,
            };
          });
          addTable({ id: uuid(), name: file.name.replace(/\.\w+$/, ''), source: file.name, columns, rowCount: data.length, profiledAt: new Date().toISOString() });
        },
      });
    } else if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target?.result as string);
          const arr = Array.isArray(raw) ? raw : [raw];
          if (!arr.length) return;
          const fields = Object.keys(arr[0]);
          const columns: ColumnProfile[] = fields.map(field => {
            const nullCount = arr.filter(r => r[field] == null).length;
            const nonNull = arr.filter(r => r[field] != null);
            return {
              name: field,
              datatype: typeof arr[0][field] === 'number' ? 'DECIMAL' : 'VARCHAR',
              nullPercent: Math.round((nullCount / arr.length) * 1000) / 10,
              uniquePercent: Math.round((new Set(nonNull.map(r => String(r[field]))).size / Math.max(nonNull.length, 1)) * 1000) / 10,
              sampleValues: arr.slice(0, 3).map(r => String(r[field] ?? '')),
              isKey: new Set(nonNull.map(r => String(r[field]))).size === nonNull.length,
            };
          });
          addTable({ id: uuid(), name: file.name.replace(/\.\w+$/, ''), source: file.name, columns, rowCount: arr.length, profiledAt: new Date().toISOString() });
        } catch (err: any) {
          toast.error('Failed to parse JSON file', { description: err.message || 'Invalid JSON format' });
        }
      };
      reader.readAsText(file);
    }
  }, [addTable]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }, [processFile]);

  const simulateImportFromSource = useCallback(async (ds: DataSource) => {
    setImportingFrom(ds.id);

    try {
      let latestSource = ds;
      let discoveredTables = ds.tables || [];

      if (discoveredTables.length === 0) {
        toast.info(`Discovering files and tables for ${ds.name}…`);
        await testDataSource(ds.id);

        const latestState = useAppStore.getState();
        const latestProject = latestState.projects.find((projectEntry) => projectEntry.id === latestState.activeProjectId);
        latestSource = latestProject?.dataSources.find((source) => source.id === ds.id) || ds;
        discoveredTables = latestSource.tables || [];
      }

      if (discoveredTables.length === 0) {
        toast.error('No files or tables found', {
          description: latestSource.errorMessage || 'This source did not return any discoverable files or tables.',
        });
        return;
      }

      const latestProject = useAppStore.getState().projects.find((projectEntry) => projectEntry.id === useAppStore.getState().activeProjectId);
      const existingBySource = new Map((latestProject?.tables || []).map((table) => [table.source, table]));

      const importedTables = discoveredTables.map((tableName) => {
        const sourceLabel = `${latestSource.name} → ${tableName}`;
        const existingTable = existingBySource.get(sourceLabel);
        const tableId = existingTable?.id || uuid();

        const nextTable: TableSchema = {
          id: tableId,
          name: getImportedTableName(tableName, latestSource.type),
          source: sourceLabel,
          columns: existingTable?.columns || [],
          rowCount: existingTable?.rowCount || 0,
          profiledAt: existingTable?.profiledAt,
        };

        if (existingTable) {
          updateTable(tableId, nextTable);
        } else {
          addTable(nextTable);
        }

        return { tableId, tableName };
      });

      const results = await Promise.allSettled(
        importedTables.map(async ({ tableId, tableName }) => {
          const { data, error } = await supabase.functions.invoke('fetch-source-sample', {
            body: {
              sourceType: latestSource.type,
              table: tableName,
              connectionParams: latestSource.connectionParams || {},
              limit: 50,
            },
          });

          if (error) {
            throw new Error(error.message || `Could not profile ${tableName}`);
          }

          const sample = data as SourceSampleResult;

          if (!sample.supported) {
            throw new Error(sample.reason || `Live profiling is not supported for ${tableName}`);
          }

          if (sample.error) {
            throw new Error(sample.error);
          }

          updateTable(tableId, {
            columns: buildColumnProfiles(sample),
            rowCount: sample.rows.length,
            profiledAt: new Date().toISOString(),
          });
        })
      );

      const successfulProfiles = results.filter((result) => result.status === 'fulfilled').length;
      const failedProfiles = results.length - successfulProfiles;

      if (successfulProfiles > 0) {
        toast.success('Import complete', {
          description: `${successfulProfiles} file${successfulProfiles === 1 ? '' : 's'}/table${successfulProfiles === 1 ? '' : 's'} profiled${failedProfiles ? `, ${failedProfiles} left as discovered-only` : ''}.`,
        });
      } else {
        toast.error('Import failed', {
          description: 'The source was discovered, but profiling could not fetch any sample data.',
        });
      }

      setShowImport(false);
    } catch (err: unknown) {
      toast.error('Import from source failed', {
        description: err instanceof Error ? err.message : 'Unable to profile the selected data source.',
      });
    } finally {
      setImportingFrom(null);
    }
  }, [addTable, testDataSource, updateTable]);

  const handleReprofile = useCallback(async (tableId: string) => {
    setReprofilingTable(tableId);
    const table = project?.tables.find(t => t.id === tableId);
    if (!table) { setReprofilingTable(null); return; }

    if (llm.isConfigured) {
      try {
        const tableContext = `Table "${table.name}" with columns: ${table.columns.map(c => `${c.name} (${c.datatype}, null:${c.nullPercent}%, unique:${c.uniquePercent}%)`).join(', ')}. Row count: ${table.rowCount}.`;
        const result = await llm.generate(
          `Analyze this table schema and provide updated profiling insights. For each column, suggest if there are potential data quality issues, recommend better datatypes if applicable, and identify any anomalies. Return a brief analysis summary.`,
          tableContext,
        );
        setAiInsight(result);
      } catch (err: any) {
        toast.error('LLM profiling failed', { description: err.message || 'Could not generate AI insights' });
      }
    }

    // Update stats with slight variation (simulating re-read from source)
    const updatedColumns = table.columns.map(col => ({
      ...col,
      nullPercent: Math.max(0, col.nullPercent + (Math.random() - 0.5) * 2),
      uniquePercent: Math.min(100, Math.max(0, col.uniquePercent + (Math.random() - 0.5) * 3)),
    }));
    updateTable(tableId, {
      columns: updatedColumns,
      rowCount: table.rowCount + Math.floor(Math.random() * 200 - 50),
      profiledAt: new Date().toISOString(),
    });
    setReprofilingTable(null);
  }, [project, updateTable, llm]);

  const handleGenerateDescriptions = useCallback(async (tableId: string) => {
    const table = project?.tables.find(t => t.id === tableId);
    if (!table || !llm.isConfigured) return;
    setGeneratingDescs(tableId);
    try {
      const colList = table.columns.map(c =>
        `${c.name} (${c.datatype}, null:${c.nullPercent}%, unique:${c.uniquePercent}%, samples: ${c.sampleValues.join(', ')}${c.isKey ? ', PK' : ''})`
      ).join('\n');
      const result = await llm.generate(
        `For the table "${table.name}" with ${table.rowCount} rows, generate a one-liner business description for each column. Return ONLY a JSON object mapping column name to description string. No markdown, no explanation. Example: {"col1":"Description of col1","col2":"Description of col2"}`,
        colList,
      );

      // Robust JSON extraction: strip code fences, then find first {...} block.
      const stripped = result.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      let parsed: Record<string, string> | null = null;
      try {
        parsed = JSON.parse(stripped);
      } catch {
        const match = stripped.match(/\{[\s\S]*\}/);
        if (match) {
          try { parsed = JSON.parse(match[0]); } catch { /* fallthrough */ }
        }
      }

      if (parsed && typeof parsed === 'object') {
        const updatedColumns = table.columns.map(col => ({
          ...col,
          description: parsed![col.name] || col.description,
        }));
        updateTable(tableId, { columns: updatedColumns });
        toast.success('Column descriptions generated');
      } else {
        // Line-by-line fallback
        const lines = result.split('\n').filter(l => l.trim());
        const updatedColumns = table.columns.map((col, idx) => ({
          ...col,
          description: lines[idx]?.replace(/^[\-\*\d.]+\s*/, '').replace(/^`?\w+`?[\s:–\-]+/, '').trim() || col.description,
        }));
        updateTable(tableId, { columns: updatedColumns });
        toast.success('Column descriptions generated (best-effort parse)');
      }
    } catch (err: any) {
      console.error('generate-descriptions error:', err);
      toast.error('Failed to generate descriptions', { description: err.message || 'LLM inference error' });
    } finally {
      setGeneratingDescs(null);
    }
  }, [project, llm, updateTable]);

  const handleAiAnalyze = useCallback(async () => {
    if (!project || !llm.isConfigured || project.tables.length === 0) return;
    setAiInsightLoading(true);
    try {
      const context = project.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c => `${c.name}(${c.datatype}, null:${c.nullPercent}%, unique:${c.uniquePercent}%${c.isKey ? ', PK' : ''}${c.anomalies?.length ? ', anomalies: ' + c.anomalies.join('; ') : ''})`).join(', ')}`
      ).join('\n');
      const result = await llm.generate(
        `Analyze all these profiled tables. Identify: 1) Data quality issues, 2) Potential primary/foreign key relationships, 3) Anomalies, 4) Recommendations for data cleansing. Be concise and actionable.`,
        context,
      );
      setAiInsight(result);
    } catch (err: any) {
      setAiInsight(`Error: ${err.message}`);
    } finally {
      setAiInsightLoading(false);
    }
  }, [project, llm]);

  if (!project) return null;

  const connectedSources = (project.dataSources || []).filter(ds => ds.status === 'connected');
  const totalRows = project.tables.reduce((s, t) => s + t.rowCount, 0);
  const totalCols = project.tables.reduce((s, t) => s + t.columns.length, 0);

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" /> Profile
            </h2>
            <p className="text-sm text-muted-foreground">Analyze source data quality, keys, and relationships</p>
          </div>
          {project.tables.length > 0 && (
            <div className="flex gap-4 text-xs">
              <div className="text-center px-3 py-1.5 bg-card border border-border rounded-lg">
                <div className="font-bold text-foreground">{project.tables.length}</div>
                <div className="text-muted-foreground">Tables</div>
              </div>
              <div className="text-center px-3 py-1.5 bg-card border border-border rounded-lg">
                <div className="font-bold text-foreground">{totalCols}</div>
                <div className="text-muted-foreground">Columns</div>
              </div>
              <div className="text-center px-3 py-1.5 bg-card border border-border rounded-lg">
                <div className="font-bold text-foreground">{totalRows.toLocaleString()}</div>
                <div className="text-muted-foreground">Rows</div>
              </div>
            </div>
          )}
        </div>

        {/* AI Analyze Button + Insight */}
        {project.tables.length > 0 && llm.isConfigured && (
          <div className="mb-6">
            <button
              onClick={handleAiAnalyze}
              disabled={aiInsightLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-agent text-agent-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-agent mb-3"
            >
              {aiInsightLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Analyze Schema
              <span className="text-[10px] opacity-70 ml-1">({llm.modelName})</span>
            </button>
            {aiInsight && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-agent/5 border border-agent/20 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed text-foreground/90"
              >
                <div className="flex items-center gap-2 mb-2 text-xs text-agent font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> AI Analysis
                  <button onClick={() => setAiInsight(null)} className="ml-auto text-muted-foreground hover:text-foreground text-[10px]">dismiss</button>
                </div>
                {aiInsight}
              </motion.div>
            )}
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-all",
            dragOver ? "border-primary bg-primary/5 glow-primary" : "border-border hover:border-muted-foreground/30"
          )}
        >
          <Upload className={cn("w-8 h-8 mx-auto mb-3", dragOver ? "text-primary" : "text-muted-foreground")} />
          <p className="text-sm text-muted-foreground mb-2">Drag & drop CSV, JSON, or YAML files here</p>
          <label className="inline-block px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm cursor-pointer hover:bg-secondary/80 transition-colors">
            Browse Files
            <input type="file" accept=".csv,.json,.yaml,.yml" multiple onChange={(e) => Array.from(e.target.files || []).forEach(processFile)} className="hidden" />
          </label>
        </div>

        {/* Import from Connected Sources */}
        {connectedSources.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors mb-3"
            >
              <PlugZap className="w-4 h-4 text-primary" />
              Import from Connected Sources
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {connectedSources.length}
              </span>
              {showImport ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </button>
            <AnimatePresence>
              {showImport && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-2">
                    {connectedSources.map((ds) => {
                      const isImporting = importingFrom === ds.id;
                      const colorClass = SOURCE_TYPE_COLORS[ds.type] || 'text-muted-foreground';
                      return (
                        <div
                          key={ds.id}
                          className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-colors"
                        >
                          <Database className={cn("w-5 h-5 shrink-0", colorClass)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{ds.name}</span>
                              <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted", colorClass)}>
                                {ds.type}
                              </span>
                            </div>
                            {ds.tables && ds.tables.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {ds.tables.length} table{ds.tables.length !== 1 ? 's' : ''} available
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                            <button
                              onClick={() => simulateImportFromSource(ds)}
                              disabled={isImporting}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                isImporting
                                  ? "bg-muted text-muted-foreground cursor-wait"
                                  : "gradient-primary text-primary-foreground glow-primary hover:opacity-90"
                              )}
                            >
                              {isImporting ? (
                                <span className="flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Importing...
                                </span>
                              ) : (
                                'Import & Profile'
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Tables */}
        <div className="space-y-3">
          {project.tables.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <div
                onClick={() => setExpandedTable(expandedTable === table.id ? null : table.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                {expandedTable === table.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <Table className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm font-medium">{table.name}</span>
                {table.source.includes('→') && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">imported</span>
                )}
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  {table.columns.some(c => c.anomalies?.length) && (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="w-3 h-3" /> anomalies
                    </span>
                  )}
                  <span>{table.columns.length} cols</span>
                  <span>{table.rowCount.toLocaleString()} rows</span>
                  {table.profiledAt && (
                    <span className="text-[10px]" title={`Profiled: ${new Date(table.profiledAt).toLocaleString()}`}>
                      {new Date(table.profiledAt).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReprofile(table.id); }}
                    disabled={reprofilingTable === table.id}
                    className={cn(
                      "p-1 rounded hover:bg-muted transition-colors",
                      reprofilingTable === table.id ? "text-primary" : "text-muted-foreground hover:text-primary"
                    )}
                    title="Re-profile table"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", reprofilingTable === table.id && "animate-spin")} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateDescriptions(table.id); }}
                    disabled={generatingDescs === table.id || !llm.isConfigured}
                    className={cn(
                      "p-1 rounded hover:bg-muted transition-colors",
                      generatingDescs === table.id ? "text-agent" : !llm.isConfigured ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-agent"
                    )}
                    title={llm.isConfigured ? "AI Generate column descriptions" : "Configure LLM in Settings to enable"}
                  >
                    {generatingDescs === table.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expandedTable === table.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 text-[11px] text-muted-foreground">
                            <th className="px-4 py-2 text-left font-medium">Column</th>
                            <th className="px-4 py-2 text-left font-medium">Description</th>
                            <th className="px-4 py-2 text-left font-medium">Type</th>
                            <th className="px-4 py-2 text-center font-medium">Key</th>
                            <th className="px-4 py-2 text-right font-medium">Null %</th>
                            <th className="px-4 py-2 text-right font-medium">Unique %</th>
                            <th className="px-4 py-2 text-left font-medium">Samples</th>
                            <th className="px-4 py-2 text-left font-medium">Issues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {table.columns.map((col) => (
                            <tr key={col.name} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2 font-mono text-xs font-medium">{col.name}</td>
                              <td className="px-4 py-2 text-[11px] text-muted-foreground max-w-[200px] truncate" title={col.description}>
                                {col.description || <span className="italic text-muted-foreground/50">—</span>}
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-[10px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">{col.datatype}</span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {col.isKey && <Key className="w-3 h-3 text-primary mx-auto" />}
                              </td>
                              <td className="px-4 py-2 text-right text-xs">
                                <span className={cn(col.nullPercent > 10 ? "text-destructive" : col.nullPercent > 2 ? "text-warning" : "text-success")}>
                                  {col.nullPercent}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-xs">
                                <span className={cn(col.uniquePercent >= 99 ? "text-primary font-medium" : "text-muted-foreground")}>
                                  {col.uniquePercent}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-[11px] text-muted-foreground font-mono truncate max-w-[180px]">
                                {col.sampleValues.join(', ')}
                              </td>
                              <td className="px-4 py-2 text-[11px]">
                                {col.anomalies?.map((a, i) => (
                                  <span key={i} className="text-warning flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> {a}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
