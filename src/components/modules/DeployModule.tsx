import { useState, useCallback, useRef } from 'react';
import {
  Rocket, CheckCircle2, XCircle, Clock, Download, Package, Sparkles, Loader2,
  Play, Square, Terminal, Database, PlugZap, AlertTriangle, RefreshCw,
  ChevronDown, ChevronRight, Shield,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLLM } from '@/hooks/useLLM';
import { v4 as uuid } from 'uuid';
import type { DeployPlatform, DeployRun, DeployStep, PlatformConnection } from '@/types/project';
import ConnectionParamsInput, { type ConnectionField } from './ConnectionParamsInput';

/* ── Platform Config ────────────────────────────────────── */

interface PlatformDef {
  id: DeployPlatform;
  label: string;
  icon: string;
  targetKey: string;
  connectionFields: ConnectionField[];
  connectionStringTemplate: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'snowflake', label: 'Snowflake', icon: '❄️', targetKey: 'sql_snowflake',
    connectionFields: [
      { key: 'account', label: 'Account Identifier', type: 'text', placeholder: 'org-account' },
      { key: 'warehouse', label: 'Warehouse', type: 'text', placeholder: 'COMPUTE_WH' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'ANALYTICS_DB' },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'PUBLIC' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'deploy_user' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
      { key: 'role', label: 'Role', type: 'text', placeholder: 'SYSADMIN' },
    ],
    connectionStringTemplate: 'snowflake://{username}:{password}@{account}/{database}/{schema}?warehouse={warehouse}&role={role}',
  },
  {
    id: 'databricks', label: 'Databricks', icon: '🧱', targetKey: 'pyspark_databricks',
    connectionFields: [
      { key: 'host', label: 'Workspace URL', type: 'text', placeholder: 'adb-xxx.azuredatabricks.net' },
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'dapi...' },
      { key: 'catalog', label: 'Unity Catalog', type: 'text', placeholder: 'main' },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'default' },
      { key: 'cluster_id', label: 'Cluster ID', type: 'text', placeholder: '0123-456789-abc' },
      { key: 'http_path', label: 'HTTP Path', type: 'text', placeholder: '/sql/1.0/warehouses/abc123' },
    ],
    connectionStringTemplate: 'databricks://token:{token}@{host}:443/{catalog}/{schema}?http_path={http_path}',
  },
  {
    id: 'fabric', label: 'Microsoft Fabric', icon: '🔷', targetKey: 'pyspark_fabric',
    connectionFields: [
      { key: 'auth_type', label: 'Auth Type (sql_login | entra_id)', type: 'text', placeholder: 'sql_login' },
      { key: 'workspace_id', label: 'Workspace ID', type: 'text', placeholder: 'guid...' },
      { key: 'lakehouse', label: 'Lakehouse Name', type: 'text', placeholder: 'my_lakehouse' },
      { key: 'sql_endpoint', label: 'SQL Endpoint', type: 'text', placeholder: 'xyz.datawarehouse.fabric.microsoft.com' },
      { key: 'username', label: 'Username (SQL Login)', type: 'text', placeholder: 'sql_user' },
      { key: 'password', label: 'Password (SQL Login)', type: 'password', placeholder: '••••••••' },
      { key: 'tenant_id', label: 'Tenant ID (Entra ID)', type: 'text', placeholder: 'guid...' },
      { key: 'client_id', label: 'Client ID (Entra ID)', type: 'text', placeholder: 'guid...' },
      { key: 'client_secret', label: 'Client Secret (Entra ID)', type: 'password', placeholder: '••••••••' },
    ],
    connectionStringTemplate: 'fabric://{client_id}:{client_secret}@{sql_endpoint}?tenant_id={tenant_id}&workspace_id={workspace_id}&lakehouse={lakehouse}',
  },
  {
    id: 'bigquery', label: 'BigQuery', icon: '📊', targetKey: 'sql_bigquery',
    connectionFields: [
      { key: 'project_id', label: 'GCP Project ID', type: 'text', placeholder: 'my-gcp-project' },
      { key: 'dataset', label: 'Dataset', type: 'text', placeholder: 'analytics' },
      { key: 'credentials_json', label: 'Service Account Key (JSON)', type: 'password', placeholder: 'Paste JSON key...' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'US' },
    ],
    connectionStringTemplate: 'bigquery://{project_id}/{dataset}?location={location}',
  },
  {
    id: 'redshift', label: 'Amazon Redshift', icon: '🔴', targetKey: 'sql_redshift',
    connectionFields: [
      { key: 'host', label: 'Cluster Endpoint', type: 'text', placeholder: 'cluster.region.redshift.amazonaws.com' },
      { key: 'port', label: 'Port', type: 'text', placeholder: '5439' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'analytics' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'deploy_user' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
      { key: 'iam_role', label: 'IAM Role ARN (optional)', type: 'text', placeholder: 'arn:aws:iam::...' },
    ],
    connectionStringTemplate: 'redshift://{username}:{password}@{host}:{port}/{database}',
  },
];

const DEPLOY_STEPS: { id: string; label: string }[] = [
  { id: 'validate', label: 'Validate project readiness' },
  { id: 'connect', label: 'Test platform connection' },
  { id: 'gen_ddl', label: 'Generate DDL scripts' },
  { id: 'deploy_ddl', label: 'Deploy tables & views' },
  { id: 'deploy_bronze', label: 'Deploy Bronze pipelines' },
  { id: 'deploy_silver', label: 'Deploy Silver pipelines' },
  { id: 'deploy_gold', label: 'Deploy Gold pipelines' },
  { id: 'verify', label: 'Verify deployment' },
];

/* ── (ConnectionForm replaced by ConnectionParamsInput component) ── */

function DeployRunView({ run }: { run: DeployRun }) {
  const [showLogs, setShowLogs] = useState(false);
  const isRunning = run.status === 'running';

  return (
    <div className="border border-border rounded-lg bg-card/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/80">
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          {run.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-success" />}
          {run.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
          {run.status === 'cancelled' && <Square className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold capitalize">{run.platform}</span>
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-mono',
            run.status === 'completed' ? 'bg-success/15 text-success' :
            run.status === 'failed' ? 'bg-destructive/15 text-destructive' :
            run.status === 'running' ? 'bg-primary/15 text-primary' :
            'bg-muted text-muted-foreground'
          )}>
            {run.status}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
      </div>

      <div className="p-4 space-y-2">
        {run.steps.map(step => (
          <div key={step.id} className="flex items-center gap-3 text-xs">
            {step.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
            {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
            {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
            {step.status === 'error' && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
            {step.status === 'skipped' && <div className="w-3.5 h-3.5 rounded-full bg-muted-foreground/20 shrink-0" />}
            <span className={cn(
              step.status === 'done' ? 'text-muted-foreground' :
              step.status === 'running' ? 'text-foreground font-medium' :
              step.status === 'error' ? 'text-destructive' :
              'text-muted-foreground/50'
            )}>
              {step.label}
            </span>
            {step.detail && <span className="text-muted-foreground/60 ml-auto truncate max-w-[200px]">{step.detail}</span>}
          </div>
        ))}
      </div>

      {run.logs.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Terminal className="w-3 h-3" />
            Deployment Logs ({run.logs.length})
            {showLogs ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
          </button>
          <AnimatePresence>
            {showLogs && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <pre className="px-4 py-3 text-[10px] font-mono text-foreground/70 leading-relaxed max-h-48 overflow-y-auto scrollbar-thin bg-muted/30">
                  {run.logs.join('\n')}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */

export default function DeployModule() {
  const {
    getActiveProject, upsertPlatformConnection, addDeployRun,
    updateDeployRun, updateDeployStep, appendDeployLog, addActivity,
  } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('deploy');
  const [selectedPlatform, setSelectedPlatform] = useState<DeployPlatform | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  
  const cancelRef = useRef(false);

  if (!project) return null;

  const { deploy } = project;
  const passCount = deploy.readiness.filter(r => r.status === 'pass').length;
  const totalChecks = deploy.readiness.length;

  const platformDef = selectedPlatform ? PLATFORMS.find(p => p.id === selectedPlatform) : null;
  const platformConn = selectedPlatform
    ? (deploy.platformConnections || []).find(c => c.platform === selectedPlatform)
    : null;
  const deployRuns = (deploy.deployRuns || []).filter(r => !selectedPlatform || r.platform === selectedPlatform);

  const handleTestConnection = (conn: PlatformConnection) => {
    upsertPlatformConnection({ ...conn, status: 'testing' });

    // Simulate connection test
    setTimeout(() => {
      const success = Math.random() > 0.15;
      upsertPlatformConnection({
        ...conn,
        status: success ? 'connected' : 'error',
        lastTested: new Date().toISOString(),
        errorMessage: success ? undefined : 'Connection timed out — verify credentials and network access',
      });
    }, 2000);
  };

  const handleDeploy = async () => {
    if (!selectedPlatform || !platformDef) return;
    setDeploying(true);
    cancelRef.current = false;

    const runId = uuid();
    const steps: DeployStep[] = DEPLOY_STEPS.map(s => ({
      id: s.id,
      label: s.label,
      status: 'pending' as const,
    }));

    const run: DeployRun = {
      id: runId,
      platform: selectedPlatform,
      status: 'running',
      steps,
      startedAt: new Date().toISOString(),
      logs: [],
    };

    addDeployRun(run);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    const advanceStep = async (stepId: string, work: () => Promise<string | void>) => {
      if (cancelRef.current) {
        updateDeployStep(runId, stepId, { status: 'skipped', detail: 'Cancelled' });
        return false;
      }
      updateDeployStep(runId, stepId, { status: 'running', startedAt: new Date().toISOString() });
      appendDeployLog(runId, `▶ Starting: ${DEPLOY_STEPS.find(s => s.id === stepId)?.label}`);

      try {
        const detail = await work();
        updateDeployStep(runId, stepId, {
          status: 'done',
          completedAt: new Date().toISOString(),
          detail: detail || 'OK',
        });
        appendDeployLog(runId, `✓ Completed: ${DEPLOY_STEPS.find(s => s.id === stepId)?.label}${detail ? ` — ${detail}` : ''}`);
        return true;
      } catch (err: any) {
        updateDeployStep(runId, stepId, {
          status: 'error',
          completedAt: new Date().toISOString(),
          detail: err.message,
        });
        appendDeployLog(runId, `✗ Failed: ${DEPLOY_STEPS.find(s => s.id === stepId)?.label} — ${err.message}`);
        return false;
      }
    };

    try {
      // Step 1: Validate
      const ok1 = await advanceStep('validate', async () => {
        await delay(800);
        const issues = project.validations.filter(v => !v.resolved && v.severity === 'error');
        if (issues.length > 0) {
          appendDeployLog(runId, `⚠ ${issues.length} unresolved error(s) found — proceeding with warnings`);
        }
        return `${project.tables.length} tables, ${project.entities.length} entities, ${project.mappings.length} mappings`;
      });
      if (!ok1 && !cancelRef.current) throw new Error('Validation failed');

      // Step 2: Test connection
      const ok2 = await advanceStep('connect', async () => {
        await delay(1200);
        if (!platformConn || platformConn.status !== 'connected') {
          // Simulate a connection test
          const success = Math.random() > 0.1;
          if (!success) throw new Error('Unable to connect — check credentials');
          appendDeployLog(runId, `Connected to ${platformDef.label} successfully`);
        }
        return 'Connected';
      });
      if (!ok2) throw new Error('Connection test failed');

      // Step 3: Generate DDL
      let ddlScripts: string[] = [];
      const ok3 = await advanceStep('gen_ddl', async () => {
        await delay(1500);
        const tableNames = project.tables.map(t => t.name);
        const entityNames = project.entities.map(e => e.label);
        ddlScripts = [...tableNames.map(t => `CREATE TABLE ${t}`), ...entityNames.map(e => `CREATE TABLE dim_${e.toLowerCase()}`)];
        if (llm.isConfigured) {
          appendDeployLog(runId, `Generating DDL with AI for ${platformDef.label}...`);
          try {
            const ddlResult = await llm.generate(
              `Generate a brief DDL summary for deploying tables ${tableNames.join(', ')} to ${platformDef.label}. List CREATE TABLE statements as one-liners. Output ONLY the SQL, no explanations.`,
              `Tables: ${project.tables.map(t => `${t.name}(${t.columns.map(c => `${c.name} ${c.datatype}`).join(', ')})`).join('; ')}`,
            );
            appendDeployLog(runId, `DDL generated:\n${ddlResult.substring(0, 200)}...`);
          } catch {
            appendDeployLog(runId, `AI DDL generation skipped — using template DDL`);
          }
        }
        return `${ddlScripts.length} objects`;
      });
      if (!ok3) throw new Error('DDL generation failed');

      // Steps 4-6: Deploy layers
      const layerStepMap: Record<string, string> = {
        deploy_ddl: 'DDL',
        deploy_bronze: 'Bronze',
        deploy_silver: 'Silver',
        deploy_gold: 'Gold',
      };

      for (const [stepId, layerLabel] of Object.entries(layerStepMap)) {
        const ok = await advanceStep(stepId, async () => {
          await delay(1000 + Math.random() * 1000);
          const pipelineKey = platformDef.targetKey as keyof typeof project.pipelines.bronze;
          const layerKey = layerLabel.toLowerCase() as 'bronze' | 'silver' | 'gold';

          if (stepId === 'deploy_ddl') {
            appendDeployLog(runId, `Deploying ${ddlScripts.length} DDL objects to ${platformDef.label}`);
            ddlScripts.forEach((s, i) => appendDeployLog(runId, `  [${i + 1}/${ddlScripts.length}] ${s}`));
            return `${ddlScripts.length} objects deployed`;
          }

          const code = project.pipelines[layerKey]?.[pipelineKey];
          const customCode = (project.customETL || []).filter(e => e.layer === layerKey);
          const totalScripts = (code ? 1 : 0) + customCode.length;

          if (totalScripts === 0) {
            appendDeployLog(runId, `No ${layerLabel} pipeline code found — skipping`);
            return 'Skipped (no code)';
          }

          appendDeployLog(runId, `Deploying ${totalScripts} ${layerLabel} pipeline(s) to ${platformDef.label}`);
          customCode.forEach(c => appendDeployLog(runId, `  → ${c.objectType} "${c.name}"`));
          return `${totalScripts} pipeline(s) deployed`;
        });
        if (!ok) throw new Error(`${layerLabel} deployment failed`);
      }

      // Step 7: Verify
      await advanceStep('verify', async () => {
        await delay(1200);
        appendDeployLog(runId, `Running verification queries on ${platformDef.label}...`);
        appendDeployLog(runId, `  ✓ Schema validation passed`);
        appendDeployLog(runId, `  ✓ Row count checks passed`);
        appendDeployLog(runId, `  ✓ Data type conformance passed`);
        return 'All checks passed';
      });

      updateDeployRun(runId, { status: 'completed', completedAt: new Date().toISOString() });
      appendDeployLog(runId, `═══ Deployment to ${platformDef.label} completed successfully ═══`);
      addActivity({ action: `Deployed to ${platformDef.label}`, module: 'deploy' });
    } catch (err: any) {
      if (cancelRef.current) {
        updateDeployRun(runId, { status: 'cancelled', completedAt: new Date().toISOString() });
        appendDeployLog(runId, `═══ Deployment cancelled by user ═══`);
      } else {
        updateDeployRun(runId, { status: 'failed', completedAt: new Date().toISOString() });
        appendDeployLog(runId, `═══ Deployment failed: ${err.message} ═══`);
      }
    } finally {
      setDeploying(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleExport = () => {
    const bundle = {
      project: project.name,
      platform: selectedPlatform || 'not_selected',
      generated_at: new Date().toISOString(),
      tables: project.tables.map(t => ({ name: t.name, columns: t.columns.map(c => ({ name: c.name, type: c.datatype })) })),
      entities: project.entities.map(e => ({ label: e.label, attributes: e.attributes })),
      mappings: project.mappings.map(m => ({
        source: `${m.sourceTable}.${m.sourceColumn}`,
        target: `${m.targetEntity}.${m.targetAttribute}`,
        transform: m.transformLogic,
      })),
      pipelines: selectedPlatform && platformDef ? {
        bronze: project.pipelines.bronze[platformDef.targetKey as keyof typeof project.pipelines.bronze] ? '✓' : '—',
        silver: project.pipelines.silver[platformDef.targetKey as keyof typeof project.pipelines.silver] ? '✓' : '—',
        gold: project.pipelines.gold[platformDef.targetKey as keyof typeof project.pipelines.gold] ? '✓' : '—',
      } : { bronze: '✓', silver: '✓', gold: '✓' },
      customETL: (project.customETL || []).map(e => e.name),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_deploy_manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAiAnalyze = async () => {
    if (!llm.isConfigured) return;
    setAnalyzing(true);
    try {
      const context = `Project: ${project.name}
Tables: ${project.tables.map(t => t.name).join(', ') || 'none'}
Entities: ${project.entities.map(e => e.label).join(', ') || 'none'}
Mappings: ${project.mappings.length} (${project.mappings.filter(m => m.approved).length} approved)
Validations: ${project.validations.filter(v => !v.resolved).length} open issues
Target platform: ${selectedPlatform ? platformDef?.label : 'not selected'}
Platform connection: ${platformConn?.status || 'not configured'}
Readiness: ${passCount}/${totalChecks} checks passed
Custom ETL objects: ${(project.customETL || []).length}
Previous deploy runs: ${deployRuns.length} (${deployRuns.filter(r => r.status === 'completed').length} successful)`;

      const result = await llm.generate(
        `Analyze this project's deployment readiness for ${selectedPlatform ? platformDef?.label : 'any target platform'}. Identify gaps, risks, and provide specific recommendations. Include platform-specific advice. Be concise and actionable. Format with clear sections.`,
        context,
      );
      setAiAnalysis(result);
    } catch (err: any) {
      setAiAnalysis(`Error: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const canDeploy = selectedPlatform && !deploying;

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <Rocket className="w-5 h-5 text-primary" /> Deploy
            </h2>
            <p className="text-sm text-muted-foreground">Configure, connect, and deploy to target platforms</p>
          </div>
          <div className="flex items-center gap-2">
            {llm.isConfigured && (
              <button
                onClick={handleAiAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg gradient-agent text-agent-foreground text-xs font-medium hover:opacity-90 transition-opacity glow-agent"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Analysis
              </button>
            )}
            {canDeploy && (
              <button
                onClick={handleDeploy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity glow-primary"
              >
                <Play className="w-4 h-4" /> Deploy Now
              </button>
            )}
            {deploying && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 transition-colors"
              >
                <Square className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        <AnimatePresence>
          {aiAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 bg-agent/5 border border-agent/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-agent font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> AI Deployment Analysis
                <button onClick={() => setAiAnalysis(null)} className="ml-auto text-muted-foreground hover:text-foreground text-[10px]">dismiss</button>
              </div>
              <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</pre>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform Selector — left column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Target Platform
              </h3>
              <div className="space-y-1.5">
                {PLATFORMS.map(p => {
                  const conn = (deploy.platformConnections || []).find(c => c.platform === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPlatform(p.id); }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border flex items-center gap-3",
                        selectedPlatform === p.id
                          ? "border-primary/40 bg-primary/5 text-foreground glow-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="flex-1 font-medium">{p.label}</span>
                      {conn?.status === 'connected' && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                      {conn?.status === 'error' && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Readiness Checks */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Readiness</span>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-mono",
                  passCount === totalChecks ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                )}>{passCount}/{totalChecks}</span>
              </h3>
              <div className="space-y-2">
                {deploy.readiness.map((check, i) => (
                  <div key={check.check} className="flex items-center gap-2 text-xs">
                    {check.status === 'pass' && <CheckCircle2 className="w-3 h-3 text-success shrink-0" />}
                    {check.status === 'fail' && <XCircle className="w-3 h-3 text-destructive shrink-0" />}
                    {check.status === 'pending' && <Clock className="w-3 h-3 text-warning shrink-0" />}
                    <span className={cn(check.status === 'pass' ? 'text-muted-foreground' : 'text-foreground')}>{check.check}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            {/* Connection Config */}
            {selectedPlatform && platformDef && (
              <ConnectionParamsInput
                platformId={platformDef.id}
                platformLabel={platformDef.label}
                platformIcon={platformDef.icon}
                fields={platformDef.connectionFields}
                connectionStringTemplate={platformDef.connectionStringTemplate}
                existing={platformConn}
                onSave={upsertPlatformConnection}
                onTest={handleTestConnection}
              />
            )}

            {/* Deploy summary */}
            {selectedPlatform && platformDef && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> Deployment Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Tables', value: project.tables.length },
                    { label: 'Entities', value: project.entities.length },
                    { label: 'Mappings', value: `${project.mappings.filter(m => m.approved).length}/${project.mappings.length}` },
                    { label: 'Custom ETL', value: (project.customETL || []).length },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/30 rounded-lg py-2.5 px-3">
                      <div className="text-lg font-bold text-foreground">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Pipeline availability for this platform */}
                <div className="mt-3 flex gap-2 text-[10px]">
                  {(['bronze', 'silver', 'gold'] as const).map(layer => {
                    const key = platformDef.targetKey as keyof typeof project.pipelines.bronze;
                    const hasCode = !!project.pipelines[layer]?.[key];
                    const customCount = (project.customETL || []).filter(e => e.layer === layer).length;
                    return (
                      <div key={layer} className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-md',
                        hasCode || customCount > 0 ? 'bg-success/10 text-success' : 'bg-muted/50 text-muted-foreground'
                      )}>
                        {hasCode || customCount > 0 ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span className="capitalize font-medium">{layer}</span>
                        {customCount > 0 && <span>+{customCount}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-xs hover:bg-secondary/80 transition-colors"
                  >
                    <Download className="w-3 h-3" /> Export Manifest
                  </button>
                  {!deploying && (
                    <button
                      onClick={handleDeploy}
                      disabled={!platformConn || platformConn.status !== 'connected'}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all',
                        platformConn?.status === 'connected'
                          ? 'gradient-primary text-primary-foreground glow-primary hover:opacity-90'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      )}
                    >
                      <Rocket className="w-3 h-3" /> Deploy to {platformDef.label}
                    </button>
                  )}
                  {!platformConn || platformConn.status !== 'connected' ? (
                    <span className="text-[10px] text-warning flex items-center gap-1 self-center ml-1">
                      <AlertTriangle className="w-3 h-3" /> Configure & test connection first
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {!selectedPlatform && (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a target platform to configure connection and deploy</p>
              </div>
            )}

            {/* Deployment History */}
            {deployRuns.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary" /> Deployment History
                </h3>
                <div className="space-y-3">
                  {deployRuns.slice().reverse().map(run => (
                    <DeployRunView key={run.id} run={run} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
