import { useState } from 'react';
import { Copy, Check, Download, Code2, Sparkles, Loader2, Plus, Trash2, Table2, Eye, Play, Save, Edit3 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLLM } from '@/hooks/useLLM';
import { v4 as uuid } from 'uuid';
import type { CustomETLEntry, DeployPlatform, PipelineRun, PlatformConnection } from '@/types/project';
import ConnectionParamsInput, { type ConnectionField } from './ConnectionParamsInput';

const PLATFORM_CONFIGS: Record<DeployPlatform, { label: string; icon: string; fields: ConnectionField[]; connStr: string }> = {
  snowflake: {
    label: 'Snowflake', icon: '❄️',
    fields: [
      { key: 'account', label: 'Account', type: 'text', placeholder: 'org-account' },
      { key: 'warehouse', label: 'Warehouse', type: 'text', placeholder: 'COMPUTE_WH' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'ANALYTICS_DB' },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'PUBLIC' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'deploy_user' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
    connStr: 'snowflake://{username}:{password}@{account}/{database}/{schema}?warehouse={warehouse}',
  },
  databricks: {
    label: 'Databricks', icon: '🧱',
    fields: [
      { key: 'host', label: 'Workspace URL', type: 'text', placeholder: 'adb-xxx.azuredatabricks.net' },
      { key: 'token', label: 'Access Token', type: 'password', placeholder: 'dapi...' },
      { key: 'catalog', label: 'Catalog', type: 'text', placeholder: 'main' },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'default' },
    ],
    connStr: 'databricks://token:{token}@{host}:443/{catalog}/{schema}',
  },
  fabric: {
    label: 'Fabric', icon: '🔷',
    fields: [
      { key: 'auth_type', label: 'Auth Type', type: 'text' as const, placeholder: 'sql_login | entra_id' },
      { key: 'workspace_id', label: 'Workspace ID', type: 'text' as const, placeholder: 'guid...' },
      { key: 'lakehouse', label: 'Lakehouse', type: 'text' as const, placeholder: 'my_lakehouse' },
      { key: 'username', label: 'Username (SQL Login)', type: 'text' as const, placeholder: 'sql_user' },
      { key: 'password', label: 'Password (SQL Login)', type: 'password' as const, placeholder: '••••••••' },
      { key: 'client_id', label: 'Client ID (Entra ID)', type: 'text' as const, placeholder: 'guid...' },
      { key: 'client_secret', label: 'Client Secret (Entra ID)', type: 'password' as const, placeholder: '••••••••' },
    ],
    connStr: 'fabric://{client_id}:{client_secret}@fabric.microsoft.com?workspace_id={workspace_id}&lakehouse={lakehouse}',
  },
  bigquery: {
    label: 'BigQuery', icon: '📊',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'my-gcp-project' },
      { key: 'dataset', label: 'Dataset', type: 'text', placeholder: 'analytics' },
      { key: 'credentials_json', label: 'Service Account Key', type: 'password', placeholder: 'Paste JSON...' },
    ],
    connStr: 'bigquery://{project_id}/{dataset}',
  },
  redshift: {
    label: 'Redshift', icon: '🔴',
    fields: [
      { key: 'host', label: 'Endpoint', type: 'text', placeholder: 'cluster.region.redshift.amazonaws.com' },
      { key: 'port', label: 'Port', type: 'text', placeholder: '5439' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'analytics' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'deploy_user' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
    connStr: 'redshift://{username}:{password}@{host}:{port}/{database}',
  },
};

type Layer = 'bronze' | 'silver' | 'gold';
type Target = 'sql_snowflake' | 'sql_bigquery' | 'sql_redshift' | 'pyspark_databricks' | 'pyspark_fabric';

const layers: { id: Layer; label: string; desc: string }[] = [
  { id: 'bronze', label: 'Bronze', desc: 'Raw Ingestion' },
  { id: 'silver', label: 'Silver', desc: 'Cleaned & Conformed' },
  { id: 'gold', label: 'Gold', desc: 'Business Aggregates' },
];

const targets: { id: Target; label: string; lang: string; platform: DeployPlatform }[] = [
  { id: 'sql_snowflake', label: 'Snowflake', lang: 'sql', platform: 'snowflake' },
  { id: 'sql_bigquery', label: 'BigQuery', lang: 'sql', platform: 'bigquery' },
  { id: 'sql_redshift', label: 'Redshift', lang: 'sql', platform: 'redshift' },
  { id: 'pyspark_databricks', label: 'Databricks', lang: 'python', platform: 'databricks' },
  { id: 'pyspark_fabric', label: 'Fabric', lang: 'python', platform: 'fabric' },
];

const LAYER_DESCRIPTIONS: Record<Layer, string> = {
  bronze: 'raw data ingestion from source tables with minimal transformation',
  silver: 'cleaned, deduplicated, and conformed data with proper types and nulls handled',
  gold: 'business-level aggregates and metrics ready for analytics consumption',
};

const TARGET_DESCRIPTIONS: Record<Target, string> = {
  sql_snowflake: 'Snowflake SQL dialect',
  sql_bigquery: 'BigQuery Standard SQL',
  sql_redshift: 'Amazon Redshift SQL',
  pyspark_databricks: 'PySpark for Databricks notebooks',
  pyspark_fabric: 'PySpark for Microsoft Fabric',
};

function AddETLForm({ onAdd, onCancel, isGenerating }: {
  onAdd: (name: string, objectType: 'table' | 'view', description: string) => void;
  onCancel: () => void;
  isGenerating: boolean;
}) {
  const [name, setName] = useState('');
  const [objectType, setObjectType] = useState<'table' | 'view'>('table');
  const [description, setDescription] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border border-border rounded-lg bg-card/80 p-4 mb-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Add Table / View
        </h3>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. dim_customer"
            className="w-full bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Type</label>
          <div className="flex gap-2">
            <button onClick={() => setObjectType('table')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
                objectType === 'table' ? 'gradient-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
              <Table2 className="w-3 h-3" /> Table
            </button>
            <button onClick={() => setObjectType('view')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
                objectType === 'view' ? 'gradient-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted')}>
              <Eye className="w-3 h-3" /> View
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Description / Requirements</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Describe columns, joins, aggregations, filters..." rows={3}
          className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>
      <button onClick={() => name.trim() && onAdd(name.trim(), objectType, description.trim())}
        disabled={!name.trim() || isGenerating}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg gradient-agent text-agent-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 glow-agent">
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {isGenerating ? 'Generating ETL Code...' : 'Create with AI'}
      </button>
    </motion.div>
  );
}

export default function ETLModule() {
  const { getActiveProject, addCustomETL, removeCustomETL, updateCustomETLCode, upsertPlatformConnection, addPipelineRun, updatePipelineRun, appendPipelineLog, addActivity } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('etl');
  const [activeLayer, setActiveLayer] = useState<Layer>('bronze');
  const [activeTarget, setActiveTarget] = useState<Target>('sql_snowflake');
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [showConnection, setShowConnection] = useState(false);

  if (!project) return null;

  const currentTarget = targets.find(t => t.id === activeTarget)!;
  const customEntries = (project.customETL || []).filter(e => e.layer === activeLayer);
  const selectedCustom = selectedCustomId ? customEntries.find(e => e.id === selectedCustomId) : null;

  const codeKey = `${activeLayer}_${activeTarget}`;
  const storedCode = project.pipelines[activeLayer][activeTarget];
  const aiCode = generatedCode[codeKey];

  const code = selectedCustom
    ? (selectedCustom.code[activeTarget] || '-- No code generated for this target yet.')
    : (aiCode || storedCode);

  const platformConn = project.deploy.platformConnections.find(c => c.platform === currentTarget.platform);

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editBuffer : code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const ext = activeTarget.startsWith('pyspark') ? 'py' : 'sql';
    const prefix = selectedCustom ? selectedCustom.name : `${project.name.toLowerCase().replace(/\s+/g, '_')}_${activeLayer}_${activeTarget}`;
    const blob = new Blob([isEditing ? editBuffer : code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    setEditBuffer(code);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedCustom) {
      updateCustomETLCode(selectedCustom.id, activeTarget, editBuffer);
    } else {
      setGeneratedCode(prev => ({ ...prev, [codeKey]: editBuffer }));
    }
    setIsEditing(false);
  };

  const handleExecute = async () => {
    setExecuting(true);
    setExecResult(null);
    const codeToRun = isEditing ? editBuffer : code;

    const runId = uuid();
    const objectName = selectedCustom ? selectedCustom.name : `${activeLayer}_layer`;
    const run: PipelineRun = {
      id: runId,
      name: `Execute ${objectName} (${currentTarget.label})`,
      platform: currentTarget.platform,
      layer: selectedCustom ? 'custom' : activeLayer,
      objectName,
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: [`Executing on ${currentTarget.label}...`],
    };
    addPipelineRun(run);
    addActivity({ action: `Executed ${objectName} on ${currentTarget.label}`, module: 'etl' });

    // Simulate execution
    const steps = [
      `Connecting to ${currentTarget.label}...`,
      'Parsing query...',
      'Validating schema references...',
      'Executing statements...',
      'Processing rows...',
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
      appendPipelineLog(runId, step);
    }

    const success = Math.random() > 0.2;
    if (success) {
      const rows = Math.floor(Math.random() * 50000) + 1000;
      appendPipelineLog(runId, `✓ Completed. ${rows} rows affected.`);
      updatePipelineRun(runId, { status: 'completed', completedAt: new Date().toISOString(), duration: Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000), rowsProcessed: rows });
      setExecResult({ status: 'success', message: `Executed successfully on ${currentTarget.label}. ${rows} rows affected.` });
    } else {
      const err = `Syntax error near line ${Math.floor(Math.random() * 20) + 1}: unexpected token`;
      appendPipelineLog(runId, `✗ ${err}`);
      updatePipelineRun(runId, { status: 'failed', completedAt: new Date().toISOString(), duration: Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000), errorMessage: err });
      setExecResult({ status: 'error', message: err });
    }
    setExecuting(false);
  };

  const handleAiGenerate = async () => {
    if (!llm.isConfigured) return;
    setGenerating(true);
    try {
      const tablesCtx = project.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c => `${c.name} ${c.datatype}${c.isKey ? ' PK' : ''}`).join(', ')}`
      ).join('\n');
      const entitiesCtx = project.entities.length > 0
        ? project.entities.map(e => `Entity "${e.label}": ${e.attributes.join(', ')}`).join('\n') : '';
      const mappingsCtx = project.mappings.length > 0
        ? project.mappings.map(m => `${m.sourceTable}.${m.sourceColumn} → ${m.targetEntity}.${m.targetAttribute} (${m.transformLogic})`).join('\n') : '';
      const context = `Source Tables:\n${tablesCtx}${entitiesCtx ? `\n\nTarget Entities:\n${entitiesCtx}` : ''}${mappingsCtx ? `\n\nMappings:\n${mappingsCtx}` : ''}`;
      const result = await llm.generate(
        `Generate ${LAYER_DESCRIPTIONS[activeLayer]} ETL code in ${TARGET_DESCRIPTIONS[activeTarget]}. Create production-ready ${activeTarget.startsWith('pyspark') ? 'PySpark' : 'SQL'} code based on the source tables${mappingsCtx ? ' and defined mappings' : ''}. Include comments explaining each transformation step. Output ONLY the code, no explanations.`,
        context,
      );
      setGeneratedCode(prev => ({ ...prev, [codeKey]: result }));
    } catch (err: any) {
      setGeneratedCode(prev => ({ ...prev, [codeKey]: `-- Error generating code: ${err.message}` }));
    } finally {
      setGenerating(false);
    }
  };

  const handleAddCustomETL = async (name: string, objectType: 'table' | 'view', description: string) => {
    if (!llm.isConfigured) return;
    setGenerating(true);
    try {
      const tablesCtx = project.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c => `${c.name} ${c.datatype}${c.isKey ? ' PK' : ''}`).join(', ')}`
      ).join('\n');
      const existingCustom = (project.customETL || []).map(e => `${e.objectType} "${e.name}" (${e.layer})`).join(', ');
      const codeMap: Record<string, string> = {};
      for (const t of targets) {
        const result = await llm.generate(
          `Generate production-ready ${t.lang === 'python' ? 'PySpark' : 'SQL'} code in ${TARGET_DESCRIPTIONS[t.id]} to CREATE ${objectType === 'view' ? 'VIEW' : 'TABLE'} "${name}" for the ${activeLayer} layer (${LAYER_DESCRIPTIONS[activeLayer]}).
${description ? `\nRequirements: ${description}` : ''}
${existingCustom ? `\nExisting custom objects: ${existingCustom}` : ''}

Based on available source tables, generate the full DDL/ETL code with comments. Output ONLY the code.`,
          `Source Tables:\n${tablesCtx}`,
        );
        codeMap[t.id] = result;
      }
      const entry: CustomETLEntry = { id: uuid(), name, objectType, description, layer: activeLayer, code: codeMap, createdAt: new Date().toISOString() };
      addCustomETL(entry);
      setSelectedCustomId(entry.id);
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Failed to generate custom ETL:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteCustom = (id: string) => {
    removeCustomETL(id);
    if (selectedCustomId === id) setSelectedCustomId(null);
  };

  const layerColors: Record<Layer, string> = { bronze: 'text-warning', silver: 'text-muted-foreground', gold: 'text-primary' };

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <Code2 className="w-5 h-5 text-primary" /> ETL Code
            </h2>
            <p className="text-sm text-muted-foreground">Edit, generate, and execute transformation code on target platforms</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowAddForm(true); setSelectedCustomId(null); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/80 text-secondary-foreground text-sm font-medium hover:bg-secondary transition-colors">
              <Plus className="w-4 h-4" /> Add Table / View
            </button>
            {llm.isConfigured && !selectedCustom && (
              <button onClick={handleAiGenerate} disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-agent text-agent-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-agent">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI Generate
              </button>
            )}
          </div>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && <AddETLForm onAdd={handleAddCustomETL} onCancel={() => setShowAddForm(false)} isGenerating={generating} />}
        </AnimatePresence>

        {/* Layer Tabs */}
        <div className="flex gap-2 mb-3">
          {layers.map(l => (
            <button key={l.id} onClick={() => { setActiveLayer(l.id); setSelectedCustomId(null); setIsEditing(false); }}
              className={cn('px-4 py-2.5 rounded-lg text-sm font-medium transition-all relative',
                activeLayer === l.id ? 'bg-card border border-border shadow-md' : 'text-muted-foreground hover:bg-muted/50')}>
              <span className={cn(activeLayer === l.id && layerColors[l.id], 'font-semibold')}>{l.label}</span>
              <span className="text-[10px] text-muted-foreground ml-1.5">{l.desc}</span>
            </button>
          ))}
        </div>

        {/* Custom Tables/Views */}
        {customEntries.length > 0 && (
          <div className="flex gap-1.5 mb-3 flex-wrap">
            <button onClick={() => { setSelectedCustomId(null); setIsEditing(false); }}
              className={cn('px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
                !selectedCustomId ? 'bg-accent text-accent-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60')}>
              Pipeline Code
            </button>
            {customEntries.map(entry => (
              <div key={entry.id} className="flex items-center gap-0.5">
                <button onClick={() => { setSelectedCustomId(entry.id); setIsEditing(false); }}
                  className={cn('px-3 py-1.5 rounded-l-md text-[11px] font-mono transition-all flex items-center gap-1.5',
                    selectedCustomId === entry.id ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60')}>
                  {entry.objectType === 'view' ? <Eye className="w-3 h-3" /> : <Table2 className="w-3 h-3" />}
                  {entry.name}
                </button>
                <button onClick={() => handleDeleteCustom(entry.id)}
                  className="px-1.5 py-1.5 rounded-r-md bg-muted/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Target Platform Tabs + Connection Toggle */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {targets.map(t => (
              <button key={t.id} onClick={() => { setActiveTarget(t.id); setIsEditing(false); setExecResult(null); }}
                className={cn('px-3 py-1.5 rounded-md text-[11px] font-mono transition-all',
                  activeTarget === t.id ? 'gradient-primary text-primary-foreground glow-primary' : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary')}>
                {t.label}
                {platformConn?.status === 'connected' && t.platform === platformConn.platform && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-success inline-block" />
                )}
              </button>
            ))}
          </div>
          <button onClick={() => setShowConnection(!showConnection)}
            className={cn('text-[11px] px-3 py-1.5 rounded-md transition-all',
              showConnection ? 'bg-primary/20 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60')}>
            {platformConn?.status === 'connected' ? '🟢 Connected' : '⚙️ Configure'} {currentTarget.label}
          </button>
        </div>

        {/* Connection Config */}
        <AnimatePresence>
          {showConnection && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3">
              <ConnectionParamsInput
                platformId={currentTarget.platform}
                platformLabel={PLATFORM_CONFIGS[currentTarget.platform].label}
                platformIcon={PLATFORM_CONFIGS[currentTarget.platform].icon}
                fields={PLATFORM_CONFIGS[currentTarget.platform].fields}
                connectionStringTemplate={PLATFORM_CONFIGS[currentTarget.platform].connStr}
                existing={platformConn}
                onSave={(conn) => upsertPlatformConnection(conn)}
                onTest={(conn) => {
                  upsertPlatformConnection({ ...conn, status: 'testing' });
                  setTimeout(() => {
                    const success = Math.random() > 0.2;
                    upsertPlatformConnection({
                      ...conn,
                      status: success ? 'connected' : 'error',
                      lastTested: new Date().toISOString(),
                      errorMessage: success ? undefined : 'Connection failed — check credentials',
                    });
                  }, 1500);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Execution result banner */}
        <AnimatePresence>
          {execResult && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={cn('mb-3 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between',
                execResult.status === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20')}>
              <span>{execResult.message}</span>
              <button onClick={() => setExecResult(null)} className="text-[10px] opacity-60 hover:opacity-100">dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Code Block */}
        <div className="flex-1 bg-muted/40 border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', activeLayer === 'bronze' ? 'bg-warning' : activeLayer === 'silver' ? 'bg-muted-foreground' : 'bg-primary')} />
              {selectedCustom
                ? `${selectedCustom.name}.${activeTarget.startsWith('pyspark') ? 'py' : 'sql'}`
                : `${activeLayer}_layer.${activeTarget.startsWith('pyspark') ? 'py' : 'sql'}`}
              {isEditing && <span className="text-warning text-[9px] ml-2">● EDITING</span>}
              {!isEditing && selectedCustom && <span className="text-agent text-[9px] ml-2">✨ {selectedCustom.objectType.toUpperCase()}</span>}
              {!isEditing && !selectedCustom && aiCode && <span className="text-agent text-[9px] ml-2">✨ AI Generated</span>}
            </span>
            <div className="flex gap-1">
              {!isEditing ? (
                <button onClick={handleEdit} className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              ) : (
                <button onClick={handleSave} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors text-xs">
                  <Save className="w-3 h-3" /> Save
                </button>
              )}
              <button onClick={handleCopy} disabled={!code} className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground">
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={handleExport} disabled={!code} className="flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground">
                <Download className="w-3 h-3" /> Export
              </button>
              <button onClick={handleExecute} disabled={executing || !code}
                className={cn('flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all',
                  executing ? 'bg-info/20 text-info' : 'bg-primary/15 text-primary hover:bg-primary/25')}>
                {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {executing ? 'Running...' : `Execute on ${currentTarget.label}`}
              </button>
            </div>
          </div>
          {isEditing ? (
            <textarea
              value={editBuffer}
              onChange={e => setEditBuffer(e.target.value)}
              className="flex-1 overflow-auto scrollbar-thin p-5 text-[12px] font-mono leading-relaxed text-foreground/85 bg-transparent resize-none focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <pre className="flex-1 overflow-auto scrollbar-thin p-5 text-[12px] font-mono leading-relaxed text-foreground/85">
              {code || (llm.isConfigured
                ? '-- No pipeline code generated yet.\n-- Click "AI Generate" above or use the AI Agent.'
                : '-- No pipeline code generated yet.\n-- Use the AI Agent → "Generate Bronze layer"'
              )}
            </pre>
          )}
        </div>
      </motion.div>
    </div>
  );
}
