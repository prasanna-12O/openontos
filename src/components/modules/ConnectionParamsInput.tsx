import { useState, useMemo } from 'react';
import {
  Eye, EyeOff, PlugZap, CheckCircle2, XCircle, Loader2, Copy, Check, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlatformConnection } from '@/types/project';

/* ── Types ───────────────────────────────────────────────── */

export interface ConnectionField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
  required?: boolean;
  group?: string;
}

export interface ConnectionParamsInputProps {
  platformId: string;
  platformLabel: string;
  platformIcon: string;
  fields: ConnectionField[];
  connectionStringTemplate: string;
  existing?: PlatformConnection;
  onSave: (conn: PlatformConnection) => void;
  onTest: (conn: PlatformConnection) => void;
}

/* ── Parsing helpers ─────────────────────────────────────── */

function parseConnectionString(
  platformId: string,
  template: string,
  raw: string,
): Record<string, string> | null {
  const trimmed = raw.trim();
  try {
    if (platformId === 'snowflake') {
      const m = trimmed.match(/snowflake:\/\/([^:]+):([^@]+)@([^/]+)\/([^/]+)\/([^?]+)(?:\?(.*))?/);
      if (m) {
        const p: Record<string, string> = { username: m[1], password: m[2], account: m[3], database: m[4], schema: m[5] };
        m[6]?.split('&').forEach(s => { const [k, v] = s.split('='); if (k) p[k] = v ?? ''; });
        return p;
      }
    } else if (platformId === 'redshift') {
      const m = trimmed.match(/redshift:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (m) return { username: m[1], password: m[2], host: m[3], port: m[4], database: m[5] };
    } else if (platformId === 'databricks') {
      const m = trimmed.match(/databricks:\/\/token:([^@]+)@([^:]+):\d+\/([^/]+)\/([^?]+)(?:\?(.*))?/);
      if (m) {
        const p: Record<string, string> = { token: m[1], host: m[2], catalog: m[3], schema: m[4] };
        m[5]?.split('&').forEach(s => { const [k, v] = s.split('='); if (k) p[k] = v ?? ''; });
        return p;
      }
    } else if (platformId === 'bigquery') {
      const m = trimmed.match(/bigquery:\/\/([^/]+)\/([^?]+)(?:\?(.*))?/);
      if (m) {
        const p: Record<string, string> = { project_id: m[1], dataset: m[2] };
        m[3]?.split('&').forEach(s => { const [k, v] = s.split('='); if (k) p[k] = v ?? ''; });
        return p;
      }
    } else if (platformId === 'fabric') {
      const m = trimmed.match(/fabric:\/\/([^:]+):([^@]+)@([^?]+)(?:\?(.*))?/);
      if (m) {
        const p: Record<string, string> = { client_id: m[1], client_secret: m[2], sql_endpoint: m[3] };
        m[4]?.split('&').forEach(s => { const [k, v] = s.split('='); if (k) p[k] = v ?? ''; });
        return p;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/* ── Component ───────────────────────────────────────────── */

export default function ConnectionParamsInput({
  platformId,
  platformLabel,
  platformIcon,
  fields,
  connectionStringTemplate,
  existing,
  onSave,
  onTest,
}: ConnectionParamsInputProps) {
  const [form, setForm] = useState<Record<string, string>>(existing?.credentials || {});
  const [showPasswords, setShowPasswords] = useState(false);
  const [mode, setMode] = useState<'params' | 'connstring'>('params');
  const [connStringInput, setConnStringInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState(false);

  /* ── Derived ──────── */

  const filledCount = fields.filter(f => !!form[f.key]?.trim()).length;
  const totalRequired = fields.filter(f => f.required !== false).length;
  const requiredFilled = fields.filter(f => f.required !== false && !!form[f.key]?.trim()).length;

  const generatedConnString = useMemo(() => {
    let str = connectionStringTemplate;
    fields.forEach(f => {
      str = str.replace(`{${f.key}}`, form[f.key] || `<${f.key}>`);
    });
    return str;
  }, [form, fields, connectionStringTemplate]);

  const conn: PlatformConnection = {
    platform: platformId as any,
    credentials: form,
    status: existing?.status || 'disconnected',
    lastTested: existing?.lastTested,
    errorMessage: existing?.errorMessage,
  };

  /* ── Handlers ─────── */

  const handleParse = () => {
    const parsed = parseConnectionString(platformId, connectionStringTemplate, connStringInput);
    if (parsed && Object.keys(parsed).length > 0) {
      setForm(prev => ({ ...prev, ...parsed }));
      setMode('params');
      setParseError(false);
    } else {
      setParseError(true);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedConnString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleFieldChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  /* ── Status badge ─── */

  const statusBadge = existing?.status === 'connected' ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-mono">
      <CheckCircle2 className="w-3 h-3" /> Connected
    </span>
  ) : existing?.status === 'testing' ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
      <Loader2 className="w-3 h-3 animate-spin" /> Testing…
    </span>
  ) : existing?.status === 'error' ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-mono">
      <XCircle className="w-3 h-3" /> Error
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
      Not connected
    </span>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/80">
        <div className="flex items-center gap-2.5">
          <PlugZap className="w-4 h-4 text-primary" />
          <span className="text-lg">{platformIcon}</span>
          <span className="text-sm font-semibold">{platformLabel} Connection</span>
          {statusBadge}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {filledCount}/{fields.length} fields
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setMode('params')}
            className={cn(
              'text-[11px] px-3 py-1.5 rounded-md transition-all font-medium',
              mode === 'params'
                ? 'bg-primary/15 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Parameters
          </button>
          <button
            onClick={() => setMode('connstring')}
            className={cn(
              'text-[11px] px-3 py-1.5 rounded-md transition-all font-medium flex items-center gap-1.5',
              mode === 'connstring'
                ? 'bg-primary/15 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Link2 className="w-3 h-3" /> Connection String
          </button>
        </div>

        {mode === 'connstring' ? (
          /* ── Connection String Mode ── */
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1.5 block tracking-wider">
                Paste Connection String
              </label>
              <textarea
                value={connStringInput}
                onChange={e => { setConnStringInput(e.target.value); setParseError(false); }}
                placeholder={connectionStringTemplate}
                className={cn(
                  'w-full bg-muted/50 border rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[72px] resize-y transition-colors',
                  parseError ? 'border-destructive/60' : 'border-border'
                )}
              />
              {parseError && (
                <p className="text-[10px] text-destructive mt-1">
                  Could not parse connection string. Expected format:
                  <code className="ml-1 bg-muted/50 px-1 rounded text-[9px]">{connectionStringTemplate}</code>
                </p>
              )}
            </div>
            <button
              onClick={handleParse}
              disabled={!connStringInput.trim()}
              className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Parse & Fill Fields
            </button>
          </div>
        ) : (
          /* ── Parameters Mode ── */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map(f => {
                const isFilled = !!form[f.key]?.trim();
                const isRequired = f.required !== false;
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider flex items-center gap-1.5">
                      {f.label}
                      {isRequired && <span className="text-primary/60">*</span>}
                      {isFilled && <CheckCircle2 className="w-2.5 h-2.5 text-success/60 ml-auto" />}
                    </label>
                    <input
                      type={f.type === 'password' && !showPasswords ? 'password' : 'text'}
                      value={form[f.key] || ''}
                      onChange={e => handleFieldChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={cn(
                        'w-full bg-muted/40 border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors placeholder:text-muted-foreground/40',
                        isFilled ? 'border-success/20' : 'border-border'
                      )}
                    />
                  </div>
                );
              })}
            </div>

            {/* Auto-generated connection string preview */}
            <div className="bg-muted/20 border border-border/60 rounded-lg px-3 py-2.5 group relative">
              <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1 block">
                Generated Connection String
              </label>
              <code className="text-[10px] text-foreground/60 font-mono break-all leading-relaxed block">
                {generatedConnString}
              </code>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy connection string"
              >
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </>
        )}

        {/* Password visibility toggle */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPasswords ? 'Hide' : 'Show'} passwords
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave({ ...conn, credentials: form })}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => onTest({ ...conn, credentials: form, status: 'testing' })}
              disabled={requiredFilled < totalRequired}
              className={cn(
                'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
                requiredFilled >= totalRequired
                  ? 'gradient-primary text-primary-foreground hover:opacity-90 glow-primary'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <PlugZap className="w-3.5 h-3.5" /> Test Connection
            </button>
          </div>
        </div>

        {/* Status feedback */}
        {existing?.status === 'connected' && (
          <div className="flex items-center gap-2 text-xs text-success bg-success/5 border border-success/15 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Connected successfully</span>
            {existing.lastTested && (
              <span className="text-muted-foreground ml-auto text-[10px]">
                {new Date(existing.lastTested).toLocaleString()}
              </span>
            )}
          </div>
        )}
        {existing?.status === 'error' && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{existing.errorMessage || 'Connection failed'}</span>
          </div>
        )}
        {existing?.status === 'testing' && (
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Testing connection…</span>
          </div>
        )}
      </div>
    </div>
  );
}
