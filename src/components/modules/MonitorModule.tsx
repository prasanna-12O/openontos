import { useState } from 'react';
import { Activity, AlertTriangle, Info, XCircle, CheckCircle2, Clock, Sparkles, Loader2, Play, Terminal } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useLLM } from '@/hooks/useLLM';
import type { PipelineRun } from '@/types/project';

const severityConfig = {
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
};

const runStatusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  queued: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30' },
  running: { icon: Loader2, color: 'text-info', bg: 'bg-info/10' },
  completed: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  cancelled: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
};

export default function MonitorModule() {
  const { getActiveProject, resolveValidation } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('monitor');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'validations' | 'pipelines'>('pipelines');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (!project) return null;

  const open = project.validations.filter(v => !v.resolved);
  const resolved = project.validations.filter(v => v.resolved);
  const warnings = open.filter(v => v.severity === 'warning').length;
  const errors = open.filter(v => v.severity === 'error').length;
  const infos = open.filter(v => v.severity === 'info').length;

  const pipelineRuns = (project.pipelineRuns || []).slice().reverse();
  const runningCount = pipelineRuns.filter(r => r.status === 'running').length;
  const failedCount = pipelineRuns.filter(r => r.status === 'failed').length;
  const completedCount = pipelineRuns.filter(r => r.status === 'completed').length;
  const selectedRun = selectedRunId ? pipelineRuns.find(r => r.id === selectedRunId) : null;

  const handleAiAnalyze = async () => {
    if (!llm.isConfigured) return;
    setAnalyzing(true);
    try {
      const issuesCtx = project.validations.map(v =>
        `[${v.severity.toUpperCase()}] ${v.message} - ${v.details} (module: ${v.module}, resolved: ${v.resolved})`
      ).join('\n');
      const runsCtx = pipelineRuns.slice(0, 10).map(r =>
        `[${r.status.toUpperCase()}] ${r.name} on ${r.platform} (${r.layer}) - ${r.duration || '?'}s, ${r.rowsProcessed || 0} rows${r.errorMessage ? ` ERROR: ${r.errorMessage}` : ''}`
      ).join('\n');
      const context = `Project: ${project.name}
Tables: ${project.tables.length}, Entities: ${project.entities.length}, Mappings: ${project.mappings.length}
Open issues: ${open.length} (${errors} errors, ${warnings} warnings, ${infos} info)
Pipeline runs: ${pipelineRuns.length} total (${runningCount} running, ${completedCount} completed, ${failedCount} failed)

Issues:\n${issuesCtx || 'No issues.'}

Recent Pipeline Runs:\n${runsCtx || 'No runs.'}`;

      const result = await llm.generate(
        `Analyze the pipeline health, validation issues, and recent pipeline execution results. Provide: 1) Overall health assessment, 2) Pipeline performance summary, 3) Failed pipeline root cause analysis, 4) Specific resolution steps for open issues, 5) Recommendations. Be concise and actionable.`,
        context,
      );
      setAiAnalysis(result);
    } catch (err: any) {
      setAiAnalysis(`Error: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-primary" /> Monitor
            </h2>
            <p className="text-sm text-muted-foreground">Pipeline executions, health, and validation tracking</p>
          </div>
          {llm.isConfigured && (
            <button onClick={handleAiAnalyze} disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-agent text-agent-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-agent">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Health Analysis
            </button>
          )}
        </div>

        {/* AI Analysis */}
        {aiAnalysis && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-agent/5 border border-agent/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 text-xs text-agent font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> AI Health Analysis
              <button onClick={() => setAiAnalysis(null)} className="ml-auto text-muted-foreground hover:text-foreground text-[10px]">dismiss</button>
            </div>
            <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</pre>
          </motion.div>
        )}

        {/* Status Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Open Issues', value: open.length, color: open.length > 0 ? 'text-warning' : 'text-success', icon: AlertTriangle },
            { label: 'Errors', value: errors, color: errors > 0 ? 'text-destructive' : 'text-success', icon: XCircle },
            { label: 'Pipeline Runs', value: pipelineRuns.length, color: 'text-info', icon: Play },
            { label: 'Running', value: runningCount, color: runningCount > 0 ? 'text-info' : 'text-muted-foreground', icon: Loader2 },
            { label: 'Failed', value: failedCount, color: failedCount > 0 ? 'text-destructive' : 'text-success', icon: XCircle },
          ].map((tile, i) => (
            <motion.div key={tile.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <tile.icon className={cn("w-4 h-4", tile.color)} />
              </div>
              <div className={cn("text-2xl font-bold", tile.color)}>{tile.value}</div>
              <div className="text-[11px] text-muted-foreground">{tile.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('pipelines')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'pipelines' ? 'bg-card border border-border shadow-md text-foreground' : 'text-muted-foreground hover:bg-muted/50')}>
            <Play className="w-3.5 h-3.5 inline mr-1.5" /> Pipeline Runs ({pipelineRuns.length})
          </button>
          <button onClick={() => setActiveTab('validations')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'validations' ? 'bg-card border border-border shadow-md text-foreground' : 'text-muted-foreground hover:bg-muted/50')}>
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" /> Validations ({open.length})
          </button>
        </div>

        {activeTab === 'pipelines' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline Runs List */}
            <div className="lg:col-span-1 space-y-1.5 max-h-[500px] overflow-y-auto scrollbar-thin">
              {pipelineRuns.length === 0 ? (
                <div className="text-center py-10 bg-card border border-border rounded-xl">
                  <Play className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No pipeline runs yet</p>
                  <p className="text-xs text-muted-foreground/60">Execute ETL code or run pipelines to see results here</p>
                </div>
              ) : (
                pipelineRuns.map((r, i) => {
                  const cfg = runStatusConfig[r.status];
                  const Icon = cfg.icon;
                  return (
                    <motion.button key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedRunId(r.id)}
                      className={cn('w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                        selectedRunId === r.id ? 'bg-primary/10 border border-primary/20' : `${cfg.bg} border border-border/50 hover:border-border`)}>
                      <Icon className={cn('w-4 h-4 shrink-0', cfg.color, r.status === 'running' && 'animate-spin')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-mono', cfg.bg, cfg.color)}>{r.status}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{r.platform}</span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground">{r.layer}</span>
                          {r.duration && <><span className="text-[10px] text-muted-foreground">•</span><span className="text-[10px] text-muted-foreground">{r.duration}s</span></>}
                        </div>
                      </div>
                      {r.rowsProcessed && <span className="text-[10px] text-muted-foreground shrink-0">{r.rowsProcessed.toLocaleString()} rows</span>}
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Run Detail / Logs */}
            <div className="lg:col-span-2">
              {selectedRun ? (
                <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col max-h-[500px]">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      {(() => { const cfg = runStatusConfig[selectedRun.status]; const Icon = cfg.icon;
                        return <Icon className={cn('w-4 h-4', cfg.color, selectedRun.status === 'running' && 'animate-spin')} />;
                      })()}
                      <div>
                        <h3 className="text-sm font-semibold">{selectedRun.name}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {selectedRun.platform} • {selectedRun.layer} • {new Date(selectedRun.startedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {selectedRun.rowsProcessed && <span>{selectedRun.rowsProcessed.toLocaleString()} rows</span>}
                      {selectedRun.duration && <span>{selectedRun.duration}s</span>}
                    </div>
                  </div>
                  {selectedRun.errorMessage && (
                    <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
                      {selectedRun.errorMessage}
                    </div>
                  )}
                  <div className="flex-1 overflow-auto bg-muted/20 p-4">
                    <div className="space-y-1 font-mono text-[11px]">
                      {selectedRun.logs.map((log, i) => (
                        <div key={i} className={cn('leading-relaxed',
                          log.includes('✓') ? 'text-success' : log.includes('✗') || log.includes('ERROR') ? 'text-destructive' : 'text-foreground/80'
                        )}>{log}</div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-card border border-border rounded-xl">
                  <div className="text-center">
                    <Terminal className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Select a pipeline run to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Issues List */}
            <div className="lg:col-span-2 space-y-2.5">
              <h3 className="font-semibold text-sm mb-3">Validation Issues</h3>
              {project.validations.length === 0 ? (
                <div className="text-center py-10 bg-card border border-border rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-success/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All clear</p>
                </div>
              ) : (
                project.validations.map((v, i) => {
                  const config = severityConfig[v.severity];
                  const Icon = config.icon;
                  return (
                    <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className={cn('border rounded-xl p-4 transition-all',
                        v.resolved ? 'opacity-40 border-border bg-muted/20' : `${config.bg} ${config.border}`)}>
                      <div className="flex items-start gap-3">
                        <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", v.resolved ? "text-muted-foreground" : config.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={cn("text-sm font-medium", v.resolved && "line-through")}>{v.message}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{v.module}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{v.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{v.details}</p>
                          {!v.resolved && (
                            <button onClick={() => resolveValidation(v.id)}
                              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                              Mark as resolved
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Activity Timeline */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Activity Timeline</h3>
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="space-y-4">
                  {project.activity.slice().reverse().map((a, i) => (
                    <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                        {i < project.activity.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-foreground">{a.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{a.module}</span>
                          <span className="text-muted-foreground">{new Date(a.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
