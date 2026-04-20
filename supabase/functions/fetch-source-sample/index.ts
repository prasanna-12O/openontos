// Fetch real sample data from a configured data source.
// Supports: PostgreSQL, MySQL, REST API, Azure Blob (csv/json), AWS S3, Snowflake, BigQuery, Databricks.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';
import { crypto as stdCrypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts';
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReqBody {
  sourceType: string;
  table: string;
  connectionParams?: Record<string, string>;
  limit?: number;
}

interface SampleResult {
  supported: boolean;
  columns: string[];
  rows: unknown[][];
  error?: string;
  reason?: string;
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

function ok(body: SampleResult, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function unsupported(reason: string): Response {
  return ok({ supported: false, columns: [], rows: [], reason });
}

/* ─── Identifier safety ─────────────────────────────────── */
// Whitelist: allow only schema.table style identifiers (alphanumerics + _ + .)
function safeIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name)) {
    throw new Error(`Invalid table identifier: ${name}`);
  }
  return name;
}

function quoteIdentPg(name: string): string {
  // Quote each segment of schema.table individually
  return safeIdent(name).split('.').map(p => `"${p}"`).join('.');
}

function quoteIdentMySql(name: string): string {
  return safeIdent(name).split('.').map(p => `\`${p}\``).join('.');
}

/* ─── PostgreSQL ────────────────────────────────────────── */
async function fetchPostgres(table: string, params: Record<string, string>, limit: number): Promise<SampleResult> {
  const host = params.host;
  const database = params.database;
  const username = params.username || params.user;
  const password = params.password;
  const port = parseInt(params.port || '5432', 10);
  if (!host || !database || !username) {
    return { supported: true, columns: [], rows: [], error: 'host, database and username are required' };
  }

  const fq = quoteIdentPg(table);
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres({
      host,
      port,
      database,
      username,
      password,
      ssl: 'require',
      max: 1,
      idle_timeout: 5,
      connect_timeout: 15,
      prepare: false,
    });
    // Cannot bind LIMIT via parameter on every driver path — table is whitelisted, limit is clamped int
    const rowsRaw = await sql.unsafe(`SELECT * FROM ${fq} LIMIT ${limit}`);
    const cols = rowsRaw.columns?.map((c: { name: string }) => c.name) ?? Object.keys(rowsRaw[0] || {});
    const rows = (rowsRaw as Record<string, unknown>[]).map(r =>
      cols.map((c: string) => {
        const v = r[c];
        if (v == null) return '';
        if (v instanceof Date) return v.toISOString();
        return typeof v === 'object' ? JSON.stringify(v) : v;
      })
    );
    return { supported: true, columns: cols, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { supported: true, columns: [], rows: [], error: `PostgreSQL: ${msg.slice(0, 300)}` };
  } finally {
    try { await sql?.end({ timeout: 2 }); } catch { /* ignore */ }
  }
}

/* ─── REST API ─────────────────────────────────────────── */
async function fetchRestApi(params: Record<string, string>, table: string, limit: number): Promise<SampleResult> {
  const baseUrl = (params.url || params.base_url || '').replace(/\/$/, '');
  if (!baseUrl) return { supported: true, columns: [], rows: [], error: 'API URL not configured' };

  const path = table.startsWith('/') ? table : `/${table}`;
  const url = baseUrl + path;
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (params.api_key) headers['Authorization'] = `Bearer ${params.api_key}`;
  if (params.auth_header) headers['Authorization'] = params.auth_header;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    return { supported: true, columns: [], rows: [], error: `API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}` };
  }
  const data = await res.json();
  const arr: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: Record<string, unknown>[] }).data
    : Array.isArray((data as { results?: unknown[] })?.results) ? (data as { results: Record<string, unknown>[] }).results
    : Array.isArray((data as { items?: unknown[] })?.items) ? (data as { items: Record<string, unknown>[] }).items
    : [data as Record<string, unknown>];

  const trimmed = arr.slice(0, limit);
  const cols = Array.from(new Set(trimmed.flatMap(o => Object.keys(o || {}))));
  const rows = trimmed.map(o => cols.map(c => {
    const v = (o as Record<string, unknown>)[c];
    return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  }));
  return { supported: true, columns: cols, rows };
}

/* ─── Azure Blob (Shared Key auth via REST) ─────────────── */
function parseAzureConnString(cs: string): Record<string, string> {
  const out: Record<string, string> = {};
  cs.split(';').forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  });
  return out;
}

async function azureSign(accountName: string, accountKey: string, method: string, path: string, query: Record<string, string>, headers: Record<string, string>): Promise<string> {
  // Canonicalized headers (x-ms-*) sorted
  const xms = Object.keys(headers).filter(h => h.toLowerCase().startsWith('x-ms-')).sort();
  const canonHeaders = xms.map(h => `${h.toLowerCase()}:${headers[h].trim()}`).join('\n');
  // Canonicalized resource
  const queryKeys = Object.keys(query).sort();
  const canonResource = `/${accountName}${path}` + (queryKeys.length ? '\n' + queryKeys.map(k => `${k.toLowerCase()}:${query[k]}`).join('\n') : '');

  const stringToSign = [
    method.toUpperCase(),
    headers['Content-Encoding'] || '',
    headers['Content-Language'] || '',
    headers['Content-Length'] && headers['Content-Length'] !== '0' ? headers['Content-Length'] : '',
    headers['Content-MD5'] || '',
    headers['Content-Type'] || '',
    '', // Date — empty when x-ms-date is set
    headers['If-Modified-Since'] || '',
    headers['If-Match'] || '',
    headers['If-None-Match'] || '',
    headers['If-Unmodified-Since'] || '',
    headers['Range'] || '',
    canonHeaders,
    canonResource,
  ].join('\n');

  const keyBytes = decodeBase64(accountKey);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(stringToSign));
  return encodeBase64(new Uint8Array(sigBuf));
}

async function fetchAzureBlob(blobPath: string, params: Record<string, string>, limit: number): Promise<SampleResult> {
  const cs = params.connection_string || '';
  const parsed = cs ? parseAzureConnString(cs) : {};
  const accountName = params.account_name || parsed.AccountName;
  const accountKey = params.account_key || parsed.AccountKey;
  const endpointSuffix = parsed.EndpointSuffix || 'core.windows.net';
  const defaultContainer = params.container || '';

  if (!accountName || !accountKey) {
    return { supported: true, columns: [], rows: [], error: 'Azure connection string missing AccountName or AccountKey' };
  }

  // Path may be "container/blob/path.csv" OR "blob/path.csv" (then use defaultContainer)
  let container: string;
  let blob: string;
  const segs = blobPath.split('/').filter(Boolean);
  if (defaultContainer && !blobPath.startsWith(defaultContainer + '/')) {
    container = defaultContainer;
    blob = segs.join('/');
  } else {
    container = segs[0];
    blob = segs.slice(1).join('/');
  }
  if (!container || !blob) {
    return { supported: true, columns: [], rows: [], error: 'Could not determine container/blob path' };
  }

  const path = `/${container}/${blob}`;
  const host = `${accountName}.blob.${endpointSuffix}`;
  const date = new Date().toUTCString();
  const reqHeaders: Record<string, string> = {
    'x-ms-date': date,
    'x-ms-version': '2021-08-06',
  };
  const sig = await azureSign(accountName, accountKey, 'GET', path, {}, reqHeaders);
  const authz = `SharedKey ${accountName}:${sig}`;

  const res = await fetch(`https://${host}${path}`, {
    headers: { ...reqHeaders, Authorization: authz },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    return { supported: true, columns: [], rows: [], error: `Azure Blob ${res.status}: ${body}` };
  }

  const lower = blob.toLowerCase();
  if (lower.endsWith('.parquet') || lower.endsWith('.avro') || lower.endsWith('.orc')) {
    return { supported: true, columns: [], rows: [], error: `Preview supports .csv/.tsv/.json/.jsonl only — ${blob.split('.').pop()} is binary. Convert or export as CSV/JSON for preview.` };
  }
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
    const text = await res.text();
    const lines = text.split('\n').filter(Boolean).slice(0, limit);
    const objs = lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    const cols = Array.from(new Set(objs.flatMap(o => Object.keys(o || {}))));
    return { supported: true, columns: cols, rows: objs.map(o => cols.map(c => (o as Record<string, unknown>)[c] ?? '')) };
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    const text = (await res.text()).slice(0, 256 * 1024);
    const delim = lower.endsWith('.tsv') ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { supported: true, columns: [], rows: [] };
    const cols = lines[0].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1, limit + 1).map(l => l.split(delim).map(v => v.trim().replace(/^"|"$/g, '')));
    return { supported: true, columns: cols, rows };
  }
  return { supported: true, columns: [], rows: [], error: `Unsupported file extension for preview: ${blob.split('.').pop()}` };
}

/* ─── Snowflake (via connector) ────────────────────────── */
async function fetchSnowflake(table: string, params: Record<string, string>, limit: number): Promise<SampleResult> {
  const apiKey = Deno.env.get('SNOWFLAKE_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) return { supported: false, columns: [], rows: [], reason: 'Snowflake connector not linked. Connect Snowflake in Lovable to enable live preview.' };

  const fq = quoteIdentPg(table); // Snowflake accepts double-quoted identifiers
  const res = await fetch('https://connector-gateway.lovable.dev/snowflake/v2/statements', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      statement: `SELECT * FROM ${fq} LIMIT ${limit}`,
      warehouse: params.warehouse || undefined,
      database: params.database || undefined,
      schema: params.schema || undefined,
      timeout: 30,
    }),
  });
  if (!res.ok) return { supported: true, columns: [], rows: [], error: `Snowflake ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  const cols: string[] = (j.resultSetMetaData?.rowType || []).map((c: { name: string }) => c.name);
  const rows: unknown[][] = j.data || [];
  return { supported: true, columns: cols, rows };
}

/* ─── BigQuery (via connector) ─────────────────────────── */
async function fetchBigQuery(table: string, params: Record<string, string>, limit: number): Promise<SampleResult> {
  const apiKey = Deno.env.get('BIGQUERY_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) return { supported: false, columns: [], rows: [], reason: 'BigQuery connector not linked. Connect BigQuery in Lovable to enable live preview.' };
  const projectId = params.project_id || params.project;
  if (!projectId) return { supported: true, columns: [], rows: [], error: 'project_id is required for BigQuery preview' };

  safeIdent(table);
  const fq = table.includes('.') ? `\`${projectId}.${table}\`` : `\`${projectId}.${params.dataset || 'public'}.${table}\``;
  const res = await fetch(`https://connector-gateway.lovable.dev/bigquery/bigquery/v2/projects/${projectId}/queries`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `SELECT * FROM ${fq} LIMIT ${limit}`,
      useLegacySql: false,
      maximumBytesBilled: '1073741824',
    }),
  });
  if (!res.ok) return { supported: true, columns: [], rows: [], error: `BigQuery ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  const cols: string[] = (j.schema?.fields || []).map((f: { name: string }) => f.name);
  const rows: unknown[][] = (j.rows || []).map((r: { f: { v: unknown }[] }) => r.f.map((c) => c.v));
  return { supported: true, columns: cols, rows };
}

/* ─── Databricks (via connector) ───────────────────────── */
async function fetchDatabricks(table: string, params: Record<string, string>, limit: number): Promise<SampleResult> {
  const apiKey = Deno.env.get('DATABRICKS_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) return { supported: false, columns: [], rows: [], reason: 'Databricks connector not linked. Connect Databricks in Lovable to enable live preview.' };
  const warehouseId = params.warehouse_id || params.http_path;
  if (!warehouseId) return { supported: true, columns: [], rows: [], error: 'warehouse_id is required for Databricks preview' };

  const fq = quoteIdentPg(table);
  const res = await fetch('https://connector-gateway.lovable.dev/databricks/2.0/sql/statements', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warehouse_id: warehouseId,
      statement: `SELECT * FROM ${fq} LIMIT ${limit}`,
      wait_timeout: '30s',
    }),
  });
  if (!res.ok) return { supported: true, columns: [], rows: [], error: `Databricks ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const j = await res.json();
  const cols: string[] = (j.manifest?.schema?.columns || []).map((c: { name: string }) => c.name);
  const rows: unknown[][] = j.result?.data_array || [];
  return { supported: true, columns: cols, rows };
}

/* ─── AWS S3 (via connector) ───────────────────────────── */
async function fetchS3(objectKey: string, _params: Record<string, string>, limit: number): Promise<SampleResult> {
  const apiKey = Deno.env.get('AWS_S3_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) return { supported: false, columns: [], rows: [], reason: 'AWS S3 connector not linked. Connect S3 in Lovable to enable live preview.' };

  const key = objectKey.replace(/^s3:\/\/[^/]+\//, '');

  const signRes = await fetch('https://connector-gateway.lovable.dev/api/v1/sign_storage_url?provider=aws_s3&mode=read', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ object_path: key }),
  });
  if (!signRes.ok) return { supported: true, columns: [], rows: [], error: `S3 sign ${signRes.status}: ${(await signRes.text()).slice(0, 200)}` };
  const { url } = await signRes.json();

  const fileRes = await fetch(url);
  if (!fileRes.ok) return { supported: true, columns: [], rows: [], error: `S3 fetch ${fileRes.status}` };

  const lower = key.toLowerCase();
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
    const text = await fileRes.text();
    const lines = text.split('\n').filter(Boolean).slice(0, limit);
    const objs = lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    const cols = Array.from(new Set(objs.flatMap(o => Object.keys(o || {}))));
    return { supported: true, columns: cols, rows: objs.map(o => cols.map(c => (o as Record<string, unknown>)[c] ?? '')) };
  }
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    const text = (await fileRes.text()).slice(0, 256 * 1024);
    const delim = lower.endsWith('.tsv') ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return { supported: true, columns: [], rows: [] };
    const cols = lines[0].split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1, limit + 1).map(l => l.split(delim).map(v => v.trim().replace(/^"|"$/g, '')));
    return { supported: true, columns: cols, rows };
  }
  return { supported: true, columns: [], rows: [], error: `Preview only supports .csv / .tsv / .json / .jsonl / .ndjson — got ${key.split('.').pop()}` };
}

/* ─── Dispatcher ───────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body: ReqBody = await req.json();
    const { sourceType, table, connectionParams = {}, limit = 25 } = body;
    if (!sourceType || !table) return ok({ supported: false, columns: [], rows: [], error: 'sourceType and table are required' }, 400);

    const cap = Math.min(Math.max(limit, 1), 100);

    switch (sourceType) {
      case 'postgresql':
      case 'postgres':       return ok(await fetchPostgres(table, connectionParams, cap));
      case 'api':            return ok(await fetchRestApi(connectionParams, table, cap));
      case 'snowflake':      return ok(await fetchSnowflake(table, connectionParams, cap));
      case 'bigquery':       return ok(await fetchBigQuery(table, connectionParams, cap));
      case 'databricks':     return ok(await fetchDatabricks(table, connectionParams, cap));
      case 's3':             return ok(await fetchS3(table, connectionParams, cap));
      case 'azure_blob':     return ok(await fetchAzureBlob(table, connectionParams, cap));
      case 'csv':            return unsupported('CSV uploads are previewed locally from the uploaded file');
      case 'mysql':
      case 'sqlserver':
      case 'oracle':
      case 'mongodb':
      case 'redshift':
      case 'fabric_lakehouse':
      case 'fabric_warehouse':
        return unsupported(`Live preview for ${sourceType} is not yet supported. PostgreSQL, Snowflake, BigQuery, Databricks, AWS S3 and Azure Blob (csv/json) are supported.`);
      default:               return unsupported(`Unknown source type: ${sourceType}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return ok({ supported: false, columns: [], rows: [], error: msg }, 500);
  }
});
