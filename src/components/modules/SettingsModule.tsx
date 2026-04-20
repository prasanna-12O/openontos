import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Settings, Plus, Trash2, Star, StarOff, Eye, EyeOff, CheckCircle2, Pencil, HardDrive, RefreshCw, ShieldCheck, Globe, Lock, Server, WifiOff, Activity, ArrowUpRight, ArrowDownLeft, Clock, Database, Cpu, Loader2, Zap, AlertCircle, PlugZap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import { toast } from 'sonner';
import type { LLMConfig } from '@/types/project';
import { callLLMNonStreaming, BUILTIN_LOVABLE_LLM } from '@/lib/llm';
import RegistrationPolicyPanel from './RegistrationPolicyPanel';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string; latencyMs?: number };

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Network Activity Monitor ---

interface NetworkEntry {
  id: string;
  timestamp: string;
  direction: 'outbound' | 'inbound';
  category: 'static' | 'datasource' | 'deploy' | 'llm' | 'unknown';
  url: string;
  method: string;
  status?: number;
  duration?: number;
  size?: number;
}

function classifyRequest(url: string, method: string): NetworkEntry['category'] {
  const u = url.toLowerCase();
  // LLM endpoints
  if (u.includes('openai.com') || u.includes('anthropic') || u.includes('ollama') || u.includes('chat/completions') || u.includes('v1/completions') || u.includes('localhost:11434') || u.includes('together') || u.includes('groq')) return 'llm';
  // Data source connections
  if (u.includes(':5432') || u.includes(':3306') || u.includes(':1433') || u.includes(':1521') || u.includes(':27017') || u.includes('snowflakecomputing.com') || u.includes('bigquery.googleapis') || u.includes('redshift.amazonaws') || u.includes('azuredatabricks') || u.includes('database.windows.net')) return 'datasource';
  // Deploy targets (same platforms but POST/PUT with DDL)
  if ((method === 'POST' || method === 'PUT') && (u.includes('snowflakecomputing') || u.includes('bigquery') || u.includes('redshift') || u.includes('databricks') || u.includes('fabric'))) return 'deploy';
  // Static assets
  if (u.endsWith('.js') || u.endsWith('.css') || u.endsWith('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.ico') || u.endsWith('.woff2') || u.includes('/@vite') || u.includes('/node_modules/') || u.includes('hot-update')) return 'static';
  return 'unknown';
}

const categoryConfig: Record<NetworkEntry['category'], { label: string; color: string; icon: typeof Globe }> = {
  static: { label: 'Static Asset', color: 'text-muted-foreground', icon: Globe },
  datasource: { label: 'Data Source', color: 'text-cyan-400', icon: Database },
  deploy: { label: 'Deploy Target', color: 'text-orange-400', icon: Cpu },
  llm: { label: 'LLM Inference', color: 'text-violet-400', icon: Activity },
  unknown: { label: 'Other', color: 'text-muted-foreground', icon: Globe },
};

function NetworkActivityMonitor() {
  const [entries, setEntries] = useState<NetworkEntry[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [hideStatic, setHideStatic] = useState(true);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    setIsMonitoring(true);

    // Intercept fetch
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      const method = (args[1]?.method || 'GET').toUpperCase();
      const id = uuid();
      const start = Date.now();
      const category = classifyRequest(url, method);

      try {
        const resp = await origFetch.apply(this, args);
        const entry: NetworkEntry = {
          id, timestamp: new Date().toISOString(), direction: 'outbound',
          category, url, method, status: resp.status, duration: Date.now() - start,
        };
        setEntries(prev => [entry, ...prev].slice(0, 200));
        return resp;
      } catch (err) {
        const entry: NetworkEntry = {
          id, timestamp: new Date().toISOString(), direction: 'outbound',
          category, url, method, status: 0, duration: Date.now() - start,
        };
        setEntries(prev => [entry, ...prev].slice(0, 200));
        throw err;
      }
    };

    // Intercept XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as any).__oo_method = method;
      (this as any).__oo_url = typeof url === 'string' ? url : url.toString();
      return origOpen.apply(this, [method, url, ...rest] as any);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      const url = (this as any).__oo_url || '';
      const method = ((this as any).__oo_method || 'GET').toUpperCase();
      const id = uuid();
      const start = Date.now();
      const category = classifyRequest(url, method);

      this.addEventListener('loadend', () => {
        const entry: NetworkEntry = {
          id, timestamp: new Date().toISOString(), direction: 'outbound',
          category, url, method, status: this.status, duration: Date.now() - start,
        };
        setEntries(prev => [entry, ...prev].slice(0, 200));
      });
      return origSend.apply(this, args);
    };

    // Cleanup on unmount handled by storing refs
    (window as any).__oo_origFetch = origFetch;
    (window as any).__oo_origOpen = origOpen;
    (window as any).__oo_origSend = origSend;
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if ((window as any).__oo_origFetch) {
      window.fetch = (window as any).__oo_origFetch;
      XMLHttpRequest.prototype.open = (window as any).__oo_origOpen;
      XMLHttpRequest.prototype.send = (window as any).__oo_origSend;
      delete (window as any).__oo_origFetch;
      delete (window as any).__oo_origOpen;
      delete (window as any).__oo_origSend;
    }
    setIsMonitoring(false);
  }, []);

  useEffect(() => () => { stopMonitoring(); }, [stopMonitoring]);

  const filtered = hideStatic ? entries.filter(e => e.category !== 'static') : entries;

  const counts = entries.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Network Activity Monitor</CardTitle>
            {isMonitoring && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => setHideStatic(p => !p)}
            >
              {hideStatic ? 'Show Static' : 'Hide Static'}
            </Button>
            {isMonitoring ? (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={stopMonitoring}>
                Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={startMonitoring}>
                <Activity className="w-3 h-3" /> Start Monitoring
              </Button>
            )}
            {entries.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEntries([])}>Clear</Button>
            )}
          </div>
        </div>
        <CardDescription>
          Track all outbound network calls made by OpenOntos during this session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary badges */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(counts).map(([cat, count]) => {
              const cfg = categoryConfig[cat as NetworkEntry['category']];
              return (
                <Badge key={cat} variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                  <cfg.icon className="w-3 h-3" />
                  {cfg.label}: {count}
                </Badge>
              );
            })}
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Total: {entries.length}
            </Badge>
          </div>
        )}

        {!isMonitoring && entries.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">
              Click <strong>Start Monitoring</strong> to track outbound network requests in real-time.
            </p>
            <p className="text-xs text-muted-foreground">
              All calls go only to endpoints <strong>you configure</strong> — no data is sent to OpenOntos servers.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[240px] rounded-md border border-border bg-background">
            <div className="divide-y divide-border">
              {filtered.length === 0 && isMonitoring && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Listening for network requests…
                </div>
              )}
              {filtered.map(entry => {
                const cfg = categoryConfig[entry.category];
                const Icon = cfg.icon;
                const statusOk = entry.status && entry.status >= 200 && entry.status < 400;
                return (
                  <div key={entry.id} className="px-3 py-2 flex items-center gap-3 text-xs hover:bg-muted/30 transition-colors">
                    <div className={`shrink-0 ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 font-mono ${cfg.color} border-current/20`}>
                      {entry.method}
                    </Badge>
                    <span className="text-muted-foreground font-mono truncate flex-1 min-w-0" title={entry.url}>
                      {entry.url.length > 80 ? entry.url.slice(0, 80) + '…' : entry.url}
                    </span>
                    {entry.status !== undefined && (
                      <Badge variant="outline" className={`text-[10px] font-mono shrink-0 ${statusOk ? 'text-emerald-400 border-emerald-400/30' : 'text-destructive border-destructive/30'}`}>
                        {entry.status || 'ERR'}
                      </Badge>
                    )}
                    {entry.duration !== undefined && (
                      <span className="text-muted-foreground font-mono shrink-0 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {entry.duration}ms
                      </span>
                    )}
                    <span className="text-muted-foreground/50 font-mono shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <Separator />
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">Privacy guarantee:</span>{' '}
            Every request shown goes to infrastructure <strong>you</strong> own and configure.
            OpenOntos has no proxy server, no analytics, and no telemetry.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Storage Indicator ---

const FREE_TIER_BYTES = 2 * 1024 * 1024 * 1024;   // 2 GB
const PAID_TIER_BYTES = 20 * 1024 * 1024 * 1024;  // 20 GB

function StorageIndicator() {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<'free' | 'paid'>('free');
  const [serverBytes, setServerBytes] = useState<number | null>(null);

  const tierQuota = tier === 'paid' ? PAID_TIER_BYTES : FREE_TIER_BYTES;

  const estimateStorage = async () => {
    setLoading(true);
    try {
      // Pull subscription tier + server-side usage from backend
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();

      let resolvedTier: 'free' | 'paid' = 'free';
      let resolvedServerBytes: number | null = null;

      if (user) {
        const [{ data: profile }, { data: usageRow }] = await Promise.all([
          supabase.from('profiles').select('subscription_tier').eq('id', user.id).maybeSingle(),
          supabase.from('user_storage_usage').select('bytes_used').eq('user_id', user.id).maybeSingle(),
        ]);
        resolvedTier = (profile?.subscription_tier === 'paid' ? 'paid' : 'free');
        resolvedServerBytes = usageRow?.bytes_used ?? 0;
      }

      setTier(resolvedTier);
      setServerBytes(resolvedServerBytes);

      const quota = resolvedTier === 'paid' ? PAID_TIER_BYTES : FREE_TIER_BYTES;

      // Local browser usage (covers IndexedDB / cached project state)
      let localUsed = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const est = await navigator.storage.estimate();
        localUsed = est.usage ?? 0;
      } else {
        const storeData = await (await import('localforage')).default.getItem('openontos-state');
        localUsed = storeData ? new Blob([storeData as string]).size : 0;
      }

      // Use the larger of server-tracked usage vs local cache as the effective usage
      const effectiveUsed = Math.max(localUsed, resolvedServerBytes ?? 0);
      setUsage({ used: Math.min(effectiveUsed, quota * 2), quota });
    } catch {
      setUsage(null);
    }
    setLoading(false);
  };

  useEffect(() => { estimateStorage(); }, []);

  const pct = usage ? Math.min((usage.used / usage.quota) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isCritical = pct >= 100;
  const remaining = usage ? Math.max(usage.quota - usage.used, 0) : 0;

  // Block uploads when limit reached — broadcast a flag other modules can read
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __openontosStorageBlocked?: boolean }).__openontosStorageBlocked = isCritical;
      window.dispatchEvent(new CustomEvent('openontos:storage-quota', {
        detail: { tier, used: usage?.used ?? 0, quota: tierQuota, blocked: isCritical },
      }));
    }
  }, [isCritical, tier, usage?.used, tierQuota]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Storage Usage</CardTitle>
            <Badge variant={tier === 'paid' ? 'default' : 'secondary'} className="ml-1 uppercase text-[10px]">
              {tier} tier
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={estimateStorage} disabled={loading} title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          {tier === 'paid' ? '20 GB included with paid plan' : '2 GB included on free plan'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="h-8 flex items-center text-sm text-muted-foreground">Estimating…</div>
        ) : usage ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <span className={`font-semibold ${isCritical ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-foreground'}`}>
                  {formatBytes(usage.used)}
                </span>
                {' '}of {formatBytes(usage.quota)}
              </span>
              <span className={`font-mono text-xs ${isCritical ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {pct.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={pct}
              className={`h-2 ${isCritical ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-yellow-500' : ''}`}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatBytes(remaining)} remaining</span>
              {serverBytes !== null && (
                <span>Server-tracked: {formatBytes(serverBytes)}</span>
              )}
            </div>
            {isCritical && (
              <p className="text-xs text-destructive">
                ⚠ Storage limit reached. New uploads are blocked.{' '}
                {tier === 'free' ? 'Upgrade to the paid plan for 20 GB.' : 'Remove unused data to free up space.'}
              </p>
            )}
            {isWarning && !isCritical && (
              <p className="text-xs text-yellow-500">
                You've used over 80% of your {tier === 'paid' ? '20 GB' : '2 GB'} quota.
                {tier === 'free' ? ' Consider upgrading before you hit the limit.' : ''}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Quota is enforced server-side on every upload. Limits: Free 2 GB · Paid 20 GB.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to estimate storage. Sign in to view your quota.</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Privacy Panel ---

const privacyItems = [
  {
    icon: Lock,
    label: 'Data source credentials',
    detail: 'Stored in browser IndexedDB only. Never sent to any server.',
  },
  {
    icon: HardDrive,
    label: 'Schemas, ontology, mappings, ETL code',
    detail: 'All project data stays in your browser. Zero cloud dependency.',
  },
  {
    icon: Server,
    label: 'Hosting server',
    detail: 'Serves only static files (HTML/JS/CSS). No database, no API, no data collection.',
  },
  {
    icon: Globe,
    label: 'LLM inference',
    detail: 'Prompts are sent only to the API URL you configure (your own key, your own endpoint).',
  },
  {
    icon: WifiOff,
    label: 'Offline capable',
    detail: 'Once loaded, the app works without internet. Only LLM calls require connectivity.',
  },
];

function PrivacyPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <CardTitle className="text-base">Data Privacy & Residency</CardTitle>
          <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30">Local-First</Badge>
        </div>
        <CardDescription>No customer data ever leaves your browser or device</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {privacyItems.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5 w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
        <Separator className="my-2" />
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-500">GDPR / Compliance:</span>{' '}
            Customer data never crosses a network boundary you don't control. No user accounts, no analytics, no telemetry. 
            The hosting server has zero knowledge of your data.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Test Connection Row ---

function TestConnectionRow({ label, state, onTest }: { label: string; state: TestState; onTest: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={onTest}
          disabled={state.status === 'testing'}
        >
          {state.status === 'testing' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…</>
          ) : (
            <><PlugZap className="w-3.5 h-3.5" /> Test connection</>
          )}
        </Button>
        {state.status === 'ok' && (
          <Badge variant="outline" className="text-xs gap-1 text-emerald-500 border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3" /> OK{state.latencyMs ? ` · ${state.latencyMs}ms` : ''}
          </Badge>
        )}
        {state.status === 'error' && (
          <Badge variant="outline" className="text-xs gap-1 text-destructive border-destructive/40">
            <AlertCircle className="w-3 h-3" /> Failed
          </Badge>
        )}
      </div>
      {state.status === 'ok' && state.message && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-foreground font-mono">
          ↳ {state.message}
        </div>
      )}
      {state.status === 'error' && state.message && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive font-mono break-all whitespace-pre-wrap">
          {state.message}
        </div>
      )}
    </div>
  );
}

// --- Main Settings Module ---

export default function SettingsModule() {
  const { llmConfigs, addLLMConfig, updateLLMConfig, removeLLMConfig, setDefaultLLMConfig } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ name: '', apiUrl: '', apiToken: '', modelName: '' });
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  const runTest = useCallback(async (config: LLMConfig, key: string) => {
    setTestStates(prev => ({ ...prev, [key]: { status: 'testing' } }));
    const start = Date.now();
    try {
      const reply = await callLLMNonStreaming(
        config,
        'settings',
        'Reply with the single word: pong',
        [],
      );
      const latencyMs = Date.now() - start;
      setTestStates(prev => ({
        ...prev,
        [key]: { status: 'ok', message: reply.trim().slice(0, 200), latencyMs },
      }));
      toast.success(`${config.name} responded in ${latencyMs}ms`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestStates(prev => ({
        ...prev,
        [key]: { status: 'error', message, latencyMs: Date.now() - start },
      }));
      toast.error(`${config.name} failed`, { description: message });
    }
  }, []);

  const resetForm = () => {
    setForm({ name: '', apiUrl: '', apiToken: '', modelName: '' });
    setShowForm(false);
    setEditId(null);
  };

  const handleSubmit = () => {
    if (!form.name || !form.apiUrl || !form.apiToken || !form.modelName) return;
    if (editId) {
      updateLLMConfig(editId, form);
    } else {
      const config: LLMConfig = {
        id: uuid(),
        ...form,
        isDefault: llmConfigs.length === 0,
      };
      addLLMConfig(config);
    }
    resetForm();
  };

  const startEdit = (config: LLMConfig) => {
    setForm({ name: config.name, apiUrl: config.apiUrl, apiToken: config.apiToken, modelName: config.modelName });
    setEditId(config.id);
    setShowForm(true);
  };

  const toggleToken = (id: string) => setShowTokens(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Settings className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground">Configure your LLM models and API connections</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add LLM Model
        </Button>
      </div>

      {/* Built-in OpenOntos Provided LLM Inference */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Built-in OpenOntos Provided LLM Inference</CardTitle>
            <Badge variant="outline" className="text-xs text-primary border-primary/30">Default</Badge>
          </div>
          <CardDescription>
            No API key required — routed through the secure backend proxy.
            Use the test below to verify connectivity end-to-end.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TestConnectionRow
            label={`Model: ${BUILTIN_LOVABLE_LLM.modelName}`}
            state={testStates['__builtin'] || { status: 'idle' }}
            onTest={() => runTest(BUILTIN_LOVABLE_LLM, '__builtin')}
          />
          <div className="flex items-start gap-2 p-3 rounded-md bg-accent/5 border border-accent/20">
            <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-accent font-medium">Privacy notice:</span> OpenOntos does not track or store
              customer / user data in this communication.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="border-primary/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">{editId ? 'Edit' : 'Add'} LLM Model</CardTitle>
                <CardDescription>Provide your LLM API endpoint details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input placeholder="e.g. My GPT-4" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Model Name</Label>
                    <Input placeholder="e.g. gpt-4, claude-3-opus" value={form.modelName} onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>API URL</Label>
                  <Input placeholder="https://api.openai.com/v1/chat/completions" value={form.apiUrl} onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <Input type="password" placeholder="sk-..." value={form.apiToken} onChange={e => setForm(f => ({ ...f, apiToken: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} size="sm" className="gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {editId ? 'Update' : 'Save'}
                  </Button>
                  <Button onClick={resetForm} variant="outline" size="sm">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configured Models */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Configured Models</h3>
        {llmConfigs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No LLM models configured yet. Click "Add LLM Model" to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {llmConfigs.map(config => (
              <motion.div key={config.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className={config.isDefault ? 'border-primary/50 bg-primary/5' : ''}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{config.name}</span>
                          <Badge variant="outline" className="font-mono text-xs">{config.modelName}</Badge>
                          {config.isDefault && <Badge className="bg-primary/20 text-primary text-xs">Default</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{config.apiUrl}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="font-mono">
                            {showTokens[config.id] ? config.apiToken : '••••••••••••' + config.apiToken.slice(-4)}
                          </span>
                          <button onClick={() => toggleToken(config.id)} className="p-0.5 hover:text-foreground transition-colors">
                            {showTokens[config.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(config)} title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => setDefaultLLMConfig(config.id)}
                          title={config.isDefault ? 'Default model' : 'Set as default'}
                        >
                          {config.isDefault ? <Star className="w-3.5 h-3.5 text-primary fill-primary" /> : <StarOff className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeLLMConfig(config.id)} title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Separator />
                    <TestConnectionRow
                      label="Send a tiny prompt through the secure proxy"
                      state={testStates[config.id] || { status: 'idle' }}
                      onTest={() => runTest(config, config.id)}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Storage Usage Indicator */}
      <StorageIndicator />

      {/* User Registration & Data Policy */}
      <RegistrationPolicyPanel />

      {/* Network Activity Monitor */}
      <NetworkActivityMonitor />

      {/* Data Privacy & Residency */}
      <PrivacyPanel />
    </div>
  );
}
