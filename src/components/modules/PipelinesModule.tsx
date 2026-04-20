import { useState } from 'react';
import { Play, Clock, Calendar, Trash2, CheckCircle2, XCircle, Loader2, Plus, AlertTriangle, Terminal, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import type { DeployPlatform, PipelineRun } from '@/types/project';
import { useLLM } from '@/hooks/useLLM';

type Layer = 'bronze' | 'silver' | 'gold';

const platforms: { id: DeployPlatform; label: string }[] = [
  { id: 'snowflake', label: 'Snowflake' },
  { id: 'databricks', label: 'Databricks' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'bigquery', label: 'BigQuery' },
  { id: 'redshift', label: 'Redshift' },
];

const layers: { id: Layer; label: string; color: string }[] = [
  { id: 'bronze', label: 'Bronze', color: 'text-warning' },
  { id: 'silver', label: 'Silver', color: 'text-muted-foreground' },
  { id: 'gold', label: 'Gold', color: 'text-primary' },
];

const statusIcons: Record<string, { icon: React.ElementType; color: string }> = {
  queued: { icon: Clock, color: 'text-muted-foreground' },
  running: { icon: Loader2, color: 'text-info' },
  completed: { icon: CheckCircle2, color: 'text-success' },
  failed: { icon: XCircle, color: 'text-destructive' },
  cancelled: { icon: AlertTriangle, color: 'text-warning' },
};

export default function PipelinesModule() {
  const { getActiveProject, addPipelineRun, updatePipelineRun, appendPipelineLog, addPipelineSchedule, removePipelineSchedule, togglePipelineSchedule, addActivity } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('pipelines');
  const [selectedPlatform, setSelectedPlatform] = useState<DeployPlatform>('snowflake');
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedName, setSchedName] = useState('');
  const [schedCron, setSchedCron] = useState('0 2 * * *');
  const [schedLayers, setSchedLayers] = useState<Layer[]>(['bronze', 'silver', 'gold']);

  if (!project) return null;

  const runs = (project.pipelineRuns || []).filter(r => r.platform === selectedPlatform);
  const schedules = (project.pipelineSchedules || []).filter(s => s.platform === selectedPlatform);
  const activeRun = selectedRun ? runs.find(r => r.id === selectedRun) : null;

  const runPipeline = async (layer: Layer) => {
    const runId = uuid();
    const conn = project.deploy.platformConnections.find(c => c.platform === selectedPlatform);
    const run: PipelineRun = {
      id: runId,
      name: `${layer.charAt(0).toUpperCase() + layer.slice(1)} Pipeline`,
      platform: selectedPlatform,
      layer,
      objectName: `${layer}_layer`,
      status: 'running',
      startedAt: new Date().toISOString(),
      logs: [`Starting ${layer} pipeline on ${selectedPlatform}...`],
    };
    addPipelineRun(run);
    setSelectedRun(runId);
    addActivity({ action: `Started ${layer} pipeline on ${selectedPlatform}`, module: 'pipelines' });

    // Simulate execution steps
    const steps = layer === 'bronze'
      ? ['Connecting to platform...', 'Loading raw_orders...', 'Loading raw_customers...', 'Loading raw_products...', 'Loading raw_order_items...', 'Loading raw_suppliers...']
      : layer === 'silver'
      ? ['Connecting to platform...', 'Creating dim_customers...', 'Creating fact_orders...', 'Creating dim_products...', 'Running quality checks...']
      : ['Connecting to platform...', 'Building revenue_daily...', 'Building customer_lifetime_value...', 'Building product_performance...', 'Final aggregations...'];

    let totalRows = 0;
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
      const rows = Math.floor(Math.random() * 15000) + 500;
      totalRows += rows;
      appendPipelineLog(runId, `${steps[i]} (${rows} rows)`);
    }

    // Random success/fail
    const success = Math.random() > 0.15;
    await new Promise(r => setTimeout(r, 500));
    if (success) {
      appendPipelineLog(runId, `✓ ${layer} pipeline completed successfully`);
      updatePipelineRun(runId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        duration: Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000),
        rowsProcessed: totalRows,
      });
    } else {
      const err = 'ERROR: Permission denied on target schema';
      appendPipelineLog(runId, `✗ ${err}`);
      updatePipelineRun(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        duration: Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000),
        errorMessage: err,
      });
    }
  };

  const runFullPipeline = async () => {
    for (const l of ['bronze', 'silver', 'gold'] as Layer[]) {
      await runPipeline(l);
    }
  };

  const handleAddSchedule = () => {
    if (!schedName.trim()) return;
    addPipelineSchedule({
      id: uuid(),
      name: schedName.trim(),
      platform: selectedPlatform,
      layers: schedLayers,
      cron: schedCron,
      enabled: true,
      nextRun: new Date(Date.now() + 86400000).toISOString(),
    });
    setShowScheduleForm(false);
    setSchedName('');
  };

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <Play className="w-5 h-5 text-primary" /> Pipelines
            </h2>
            <p className="text-sm text-muted-foreground">Execute and schedule ETL pipelines on target platforms</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScheduleForm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/80 text-secondary-foreground text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Calendar className="w-4 h-4" /> Add Schedule
            </button>
            <button
              onClick={runFullPipeline}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-primary"
            >
              <Play className="w-4 h-4" /> Run Full Pipeline
            </button>
          </div>
        </div>

        {/* Platform selector */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedPlatform(p.id); setSelectedRun(null); }}
              className={cn(
                'px-3 py-1.5 rounded-md text-[11px] font-mono transition-all',
                selectedPlatform === p.id ? 'gradient-primary text-primary-foreground glow-primary' : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Schedule form */}
        <AnimatePresence>
          {showScheduleForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="border border-border rounded-lg bg-card/80 p-4 mb-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> New Schedule</h3>
                <button onClick={() => setShowScheduleForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Name</label>
                  <input value={schedName} onChange={e => setSchedName(e.target.value)} placeholder="e.g. Nightly Refresh"
                    className="w-full bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Cron Expression</label>
                  <input value={schedCron} onChange={e => setSchedCron(e.target.value)} placeholder="0 2 * * *"
                    className="w-full bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Layers</label>
                <div className="flex gap-2">
                  {layers.map(l => (
                    <button key={l.id} onClick={() => setSchedLayers(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])}
                      className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', schedLayers.includes(l.id) ? 'gradient-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
                    >{l.label}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleAddSchedule} disabled={!schedName.trim()}
                className="w-full py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                Create Schedule
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
          {/* Left: Run controls + history */}
          <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
            {/* Quick run */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Quick Run</h3>
              <div className="space-y-2">
                {layers.map(l => (
                  <button key={l.id} onClick={() => runPipeline(l.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-sm">
                    <span className={cn('font-medium', l.color)}>{l.label} Layer</span>
                    <Play className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* Schedules */}
            {schedules.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Schedules</h3>
                <div className="space-y-2">
                  {schedules.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                      <div>
                        <p className="text-xs font-medium">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.cron} • {s.layers.join(' → ')}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => togglePipelineSchedule(s.id)} className="p-1 hover:bg-muted rounded transition-colors">
                          {s.enabled ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        <button onClick={() => removePipelineSchedule(s.id)} className="p-1 hover:bg-destructive/10 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Run history */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Run History</h3>
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No runs yet</p>
              ) : (
                <div className="space-y-1.5">
                  {runs.slice().reverse().map(r => {
                    const si = statusIcons[r.status];
                    const Icon = si.icon;
                    return (
                      <button key={r.id} onClick={() => setSelectedRun(r.id)}
                        className={cn('w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all text-xs',
                          selectedRun === r.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/20 hover:bg-muted/40')}>
                        <Icon className={cn('w-3.5 h-3.5 shrink-0', si.color, r.status === 'running' && 'animate-spin')} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</p>
                        </div>
                        {r.duration && <span className="text-[10px] text-muted-foreground shrink-0">{r.duration}s</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Run detail / logs */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            {activeRun ? (
              <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => { const si = statusIcons[activeRun.status]; const Icon = si.icon;
                      return <Icon className={cn('w-4 h-4', si.color, activeRun.status === 'running' && 'animate-spin')} />;
                    })()}
                    <div>
                      <h3 className="text-sm font-semibold">{activeRun.name}</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {activeRun.platform} • {activeRun.layer} • {new Date(activeRun.startedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {activeRun.rowsProcessed && <span>{activeRun.rowsProcessed.toLocaleString()} rows</span>}
                    {activeRun.duration && <span>{activeRun.duration}s</span>}
                  </div>
                </div>
                {activeRun.errorMessage && (
                  <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive">
                    {activeRun.errorMessage}
                  </div>
                )}
                <div className="flex-1 overflow-auto bg-muted/20 p-4">
                  <div className="space-y-1 font-mono text-[11px]">
                    {activeRun.logs.map((log, i) => (
                      <div key={i} className={cn('leading-relaxed',
                        log.includes('✓') ? 'text-success' : log.includes('✗') || log.includes('ERROR') ? 'text-destructive' : 'text-foreground/80'
                      )}>{log}</div>
                    ))}
                    {activeRun.status === 'running' && (
                      <div className="flex items-center gap-2 text-info">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-card border border-border rounded-xl">
                <div className="text-center">
                  <Terminal className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select a run to view logs</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">or start a new pipeline execution</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
