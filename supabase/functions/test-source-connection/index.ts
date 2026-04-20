// Test a data source connection AND discover real tables/files/blobs.
// Returns: { ok, tables[], error?, reason? }
//
// Supported real-discovery sources:
//   - postgresql       → information_schema.tables (+ pg ssl)
//   - api              → HEAD/GET on baseUrl, returns array of detected paths from JSON
//   - azure_blob       → REST list-blobs (Shared Key auth)
//   - s3               → connector list_objects
//   - snowflake        → SHOW TABLES via connector
//   - bigquery         → list tables via connector
//   - databricks       → SHOW TABLES via connector
//   - fabric_lakehouse → Fabric REST API list lakehouse tables
//   - fabric_warehouse → Fabric REST API list warehouse tables
//   - csv              → uses the stored filename as the only "table"
// Other types: returns ok=true with reason="discovery_not_implemented" so UI can show friendly msg.

import postgres from 'https://deno.land/x/postgresjs@v3.4.4/mod.js';
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReqBody {
  sourceType: string;
  connectionParams?: Record<string, string>;
}
interface TestResult {
  ok: boolean;
  tables: string[];
  error?: string;
  reason?: string;
  message?: string;
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

function respond(body: TestResult, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/* ─── PostgreSQL ────────────────────────────────────────── */
async function testPostgres(p: Record<string, string>): Promise<TestResult> {
  const host = p.host;
  const database = p.database;
  const username = p.username || p.user;
  const password = p.password;
  const port = parseInt(p.port || '5432', 10);
  if (!host || !database || !username) {
    return { ok: false, tables: [], error: 'host, database and username are required' };
  }
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    sql = postgres({
      host, port, database, username, password,
      ssl: 'require',
      connect_timeout: 8,
      idle_timeout: 2,
      max: 1,
    });
    const rows = await sql<{ schema: string; name: string }[]>`
      SELECT table_schema AS schema, table_name AS name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
        AND table_type IN ('BASE TABLE','VIEW')
      ORDER BY table_schema, table_name
      LIMIT 500
    `;
    const tables = rows.map(r => `${r.schema}.${r.name}`);
    return { ok: true, tables, message: `Connected. ${tables.length} table(s)/view(s) discovered.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, tables: [], error: `PostgreSQL: ${msg}` };
  } finally {
    try { await sql?.end({ timeout: 1 }); } catch { /* ignore */ }
  }
}

/* ─── REST API ──────────────────────────────────────────── */
async function testRestApi(p: Record<string, string>): Promise<TestResult> {
  const url = p.baseUrl || p.url;
  if (!url) return { ok: false, tables: [], error: 'baseUrl is required' };
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (p.apiKey) headers['Authorization'] = p.apiKey.startsWith('Bearer ') ? p.apiKey : `Bearer ${p.apiKey}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return { ok: false, tables: [], error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    let detected: string[] = [];
    try {
      const j = await res.json();
      if (Array.isArray(j)) detected = ['/'];
      else if (j && typeof j === 'object') {
        // Detect endpoint listings: keys whose value is array, or "endpoints"/"paths"
        const o = j as Record<string, unknown>;
        if (Array.isArray(o.endpoints)) detected = (o.endpoints as unknown[]).map(String);
        else if (o.paths && typeof o.paths === 'object') detected = Object.keys(o.paths as object);
        else detected = Object.keys(o).filter(k => Array.isArray((o as Record<string, unknown>)[k])).map(k => `/${k}`);
        if (!detected.length) detected = ['/'];
      } else detected = ['/'];
    } catch {
      detected = ['/'];
    }
    return { ok: true, tables: detected.slice(0, 50), message: `Reachable. ${detected.length} endpoint(s) detected.` };
  } catch (e) {
    return { ok: false, tables: [], error: `REST API: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── Azure Blob ────────────────────────────────────────── */
function parseAzureConnString(cs: string): Record<string, string> {
  const out: Record<string, string> = {};
  cs.split(';').forEach(part => {
    const t = part.trim();
    if (!t) return;
    const eq = t.indexOf('=');
    if (eq === -1) return;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
  return out;
}

async function azureSign(accountName: string, accountKey: string, method: string, path: string, query: Record<string, string>, headers: Record<string, string>): Promise<string> {
  const xms = Object.keys(headers).filter(h => h.toLowerCase().startsWith('x-ms-')).sort();
  const canonHeaders = xms.map(h => `${h.toLowerCase()}:${headers[h].trim()}`).join('\n');
  const queryKeys = Object.keys(query).sort();
  const canonResource = `/${accountName}${path}` + (queryKeys.length ? '\n' + queryKeys.map(k => `${k.toLowerCase()}:${query[k]}`).join('\n') : '');
  const stringToSign = [
    method.toUpperCase(),
    headers['Content-Encoding'] || '',
    headers['Content-Language'] || '',
    headers['Content-Length'] && headers['Content-Length'] !== '0' ? headers['Content-Length'] : '',
    headers['Content-MD5'] || '',
    headers['Content-Type'] || '',
    '',
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

async function testAzureBlob(p: Record<string, string>): Promise<TestResult> {
  const cs = p.connection_string || '';
  const parsed = cs ? parseAzureConnString(cs) : {};
  const accountName = p.account_name || parsed.AccountName;
  const accountKey = p.account_key || parsed.AccountKey;
  const endpointSuffix = parsed.EndpointSuffix || 'core.windows.net';
  const container = p.container || '';

  if (!accountName || !accountKey) {
    return { ok: false, tables: [], error: 'Azure: missing AccountName or AccountKey in connection params' };
  }
  if (!container) {
    return { ok: false, tables: [], error: 'Azure: container name is required' };
  }

  // List blobs: GET https://{acct}.blob.core.windows.net/{container}?restype=container&comp=list
  const path = `/${container}`;
  const query = { comp: 'list', restype: 'container', maxresults: '500' };
  const qs = `?restype=container&comp=list&maxresults=500`;
  const host = `${accountName}.blob.${endpointSuffix}`;
  const date = new Date().toUTCString();
  const reqHeaders: Record<string, string> = {
    'x-ms-date': date,
    'x-ms-version': '2021-08-06',
  };
  try {
    const sig = await azureSign(accountName, accountKey, 'GET', path, query, reqHeaders);
    const res = await fetch(`https://${host}${path}${qs}`, {
      headers: { ...reqHeaders, Authorization: `SharedKey ${accountName}:${sig}` },
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 400);
      let friendly = `Azure ${res.status}`;
      if (res.status === 404) friendly = `Container "${container}" not found in account "${accountName}"`;
      else if (res.status === 403) friendly = `Access denied — check AccountKey and container permissions`;
      else if (res.status === 401) friendly = `Authentication failed — check AccountKey`;
      return { ok: false, tables: [], error: `${friendly}. ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}` };
    }
    const xml = await res.text();
    // Parse <Name>...</Name> entries (blob names) inside <Blob>...</Blob>
    const blobs: string[] = [];
    const blockRe = /<Blob>[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<\/Blob>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(xml)) !== null) {
      blobs.push(`${container}/${m[1]}`);
      if (blobs.length >= 500) break;
    }
    return { ok: true, tables: blobs, message: `Container "${container}" reachable. ${blobs.length} blob(s) found.` };
  } catch (e) {
    return { ok: false, tables: [], error: `Azure: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── AWS S3 (via connector) ────────────────────────────── */
async function testS3(p: Record<string, string>): Promise<TestResult> {
  const apiKey = Deno.env.get('AWS_S3_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) {
    return { ok: false, tables: [], reason: 'connector_not_linked', error: 'AWS S3 connector not linked. Connect S3 in Lovable to enable real discovery.' };
  }
  const bucket = p.bucket;
  if (!bucket) return { ok: false, tables: [], error: 'S3: bucket is required' };
  const prefix = p.prefix || '';
  try {
    const res = await fetch('https://connector-gateway.lovable.dev/api/v1/list_storage_objects?provider=aws_s3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bucket, prefix, max_results: 500 }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      return { ok: false, tables: [], error: `S3 ${res.status}: ${body}` };
    }
    const j = await res.json();
    const objects: string[] = (j.objects || j.Contents || j.items || []).map((o: { Key?: string; key?: string; name?: string }) => o.Key || o.key || o.name || '').filter(Boolean);
    return { ok: true, tables: objects.map(k => `s3://${bucket}/${k}`).slice(0, 500), message: `Bucket "${bucket}" reachable. ${objects.length} object(s).` };
  } catch (e) {
    return { ok: false, tables: [], error: `S3: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── Snowflake (via connector) ─────────────────────────── */
async function testSnowflake(p: Record<string, string>): Promise<TestResult> {
  const apiKey = Deno.env.get('SNOWFLAKE_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) {
    return { ok: false, tables: [], reason: 'connector_not_linked', error: 'Snowflake connector not linked.' };
  }
  const schema = p.schema || 'PUBLIC';
  try {
    const res = await fetch('https://connector-gateway.lovable.dev/snowflake/v2/statements', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        statement: `SHOW TABLES IN SCHEMA ${schema}`,
        warehouse: p.warehouse || undefined,
        database: p.database || undefined,
        schema,
        timeout: 30,
      }),
    });
    if (!res.ok) return { ok: false, tables: [], error: `Snowflake ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const j = await res.json();
    const meta = j.resultSetMetaData?.rowType || [];
    const nameIdx = meta.findIndex((c: { name: string }) => c.name?.toLowerCase() === 'name');
    const schemaIdx = meta.findIndex((c: { name: string }) => c.name?.toLowerCase().includes('schema'));
    const rows: string[][] = j.data || [];
    const tables = rows.map(r => {
      const sch = schemaIdx >= 0 ? r[schemaIdx] : schema;
      const nm = nameIdx >= 0 ? r[nameIdx] : r[1];
      return `${sch}.${nm}`;
    });
    return { ok: true, tables, message: `Snowflake reachable. ${tables.length} table(s) in ${schema}.` };
  } catch (e) {
    return { ok: false, tables: [], error: `Snowflake: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── BigQuery (via connector) ──────────────────────────── */
async function testBigQuery(p: Record<string, string>): Promise<TestResult> {
  const apiKey = Deno.env.get('BIGQUERY_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) {
    return { ok: false, tables: [], reason: 'connector_not_linked', error: 'BigQuery connector not linked.' };
  }
  const projectId = p.project_id || p.project;
  const dataset = p.dataset;
  if (!projectId || !dataset) return { ok: false, tables: [], error: 'BigQuery: project_id and dataset are required' };
  try {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/bigquery/bigquery/v2/projects/${projectId}/datasets/${dataset}/tables?maxResults=500`,
      {
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': apiKey,
        },
      },
    );
    if (!res.ok) return { ok: false, tables: [], error: `BigQuery ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const j = await res.json();
    const tables: string[] = (j.tables || []).map((t: { tableReference?: { tableId: string } }) => `${dataset}.${t.tableReference?.tableId}`).filter(Boolean);
    return { ok: true, tables, message: `BigQuery reachable. ${tables.length} table(s).` };
  } catch (e) {
    return { ok: false, tables: [], error: `BigQuery: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── Databricks (via connector) ────────────────────────── */
async function testDatabricks(p: Record<string, string>): Promise<TestResult> {
  const apiKey = Deno.env.get('DATABRICKS_API_KEY');
  if (!apiKey || !LOVABLE_API_KEY) {
    return { ok: false, tables: [], reason: 'connector_not_linked', error: 'Databricks connector not linked.' };
  }
  const warehouseId = p.warehouse_id || p.http_path;
  if (!warehouseId) return { ok: false, tables: [], error: 'Databricks: warehouse_id is required' };
  const schema = p.schema || 'default';
  try {
    const res = await fetch('https://connector-gateway.lovable.dev/databricks/2.0/sql/statements', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        warehouse_id: warehouseId,
        statement: `SHOW TABLES IN ${schema}`,
        wait_timeout: '30s',
      }),
    });
    if (!res.ok) return { ok: false, tables: [], error: `Databricks ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const j = await res.json();
    const data: string[][] = j.result?.data_array || [];
    const tables = data.map(r => `${r[0]}.${r[1]}`); // database.tableName
    return { ok: true, tables, message: `Databricks reachable. ${tables.length} table(s) in ${schema}.` };
  } catch (e) {
    return { ok: false, tables: [], error: `Databricks: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── Microsoft Fabric Lakehouse ───────────────────────── */
async function testFabricLakehouse(p: Record<string, string>): Promise<TestResult> {
  const sqlEndpoint = p.sql_endpoint;
  const workspaceId = p.workspace_id;
  const lakehouseName = p.lakehouse_name;
  const authType = p.auth_type || 'sql_login';
  
  if (!sqlEndpoint || !workspaceId || !lakehouseName) {
    return { ok: false, tables: [], error: 'Fabric Lakehouse: sql_endpoint, workspace_id and lakehouse_name are required' };
  }
  
  // Use Fabric REST API for table discovery
  const apiKey = Deno.env.get('FABRIC_API_KEY') || Deno.env.get('AZURE_CLIENT_SECRET');
  if (!apiKey || !LOVABLE_API_KEY) {
    return { ok: false, tables: [], reason: 'connector_not_linked', error: 'Fabric connector not linked. Configure FABRIC_API_KEY environment variable.' };
  }
  
  try {
    // Test connection via Fabric REST API to list tables in lakehouse
    const res = await fetch(`https://connector-gateway.lovable.dev/fabric/v1/workspaces/${workspaceId}/lakehouses/${lakehouseName}/tables`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      let friendly = `Fabric Lakehouse ${res.status}`;
      if (res.status === 404) friendly = `Lakehouse "${lakehouseName}" not found in workspace "${workspaceId}"`;
      else if (res.status === 403) friendly = `Access denied — check permissions for lakehouse`;
      else if (res.status === 401) friendly = `Authentication failed — check credentials`;
      return { ok: false, tables: [], error: `${friendly}. ${body}` };
    }
    
    const j = await res.json();
    const tables: string[] = (j.value || j.tables || []).map((t: { name?: string; displayName?: string }) => 
      `${lakehouseName}.${t.name || t.displayName || 'unknown'}`
    ).filter(Boolean);
    
    return { ok: true, tables, message: `Fabric Lakehouse "${lakehouseName}" reachable. ${tables.length} table(s) discovered.` };
  } catch (e) {
    return { ok: false, tables: [], error: `Fabric Lakehouse: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── Microsoft Fabric Warehouse ───────────────────────── */
async function testFabricWarehouse(p: Record<string, string>): Promise<TestResult> {
  const sqlEndpoint = p.sql_endpoint;
  const workspaceId = p.workspace_id;
  const warehouseName = p.warehouse_name;
  const authType = p.auth_type || 'sql_login';
  
  if (!sqlEndpoint || !workspaceId || !warehouseName) {
    return { ok: false, tables: [], error: 'Fabric Warehouse: sql_endpoint, workspace_id and warehouse_name are required' };
  }
  
  // Use Fabric REST API for table discovery
  const apiKey = Deno.env.get('FABRIC_API_KEY') || Deno.env.get('AZURE_CLIENT_SECRET');
  if (!apiKey || !LOVABLE_API_KEY) {
    return { ok: false, tables: [], reason: 'connector_not_linked', error: 'Fabric connector not linked. Configure FABRIC_API_KEY environment variable.' };
  }
  
  try {
    // Test connection via Fabric REST API to list tables in warehouse
    const res = await fetch(`https://connector-gateway.lovable.dev/fabric/v1/workspaces/${workspaceId}/warehouses/${warehouseName}/tables`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      let friendly = `Fabric Warehouse ${res.status}`;
      if (res.status === 404) friendly = `Warehouse "${warehouseName}" not found in workspace "${workspaceId}"`;
      else if (res.status === 403) friendly = `Access denied — check permissions for warehouse`;
      else if (res.status === 401) friendly = `Authentication failed — check credentials`;
      return { ok: false, tables: [], error: `${friendly}. ${body}` };
    }
    
    const j = await res.json();
    const tables: string[] = (j.value || j.tables || []).map((t: { name?: string; displayName?: string; schemaName?: string }) => {
      const schema = t.schemaName || 'dbo';
      const name = t.name || t.displayName || 'unknown';
      return `${schema}.${name}`;
    }).filter(Boolean);
    
    return { ok: true, tables, message: `Fabric Warehouse "${warehouseName}" reachable. ${tables.length} table(s) discovered.` };
  } catch (e) {
    return { ok: false, tables: [], error: `Fabric Warehouse: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/* ─── Dispatcher ────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body: ReqBody = await req.json();
    const { sourceType, connectionParams = {} } = body;
    if (!sourceType) return respond({ ok: false, tables: [], error: 'sourceType is required' }, 400);

    // Trim whitespace in all string params (Azure connection strings often have stray spaces)
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(connectionParams)) {
      cleaned[k] = typeof v === 'string' ? v.trim() : (v as string);
    }

    switch (sourceType) {
      case 'postgresql':
      case 'postgres':       return respond(await testPostgres(cleaned));
      case 'api':            return respond(await testRestApi(cleaned));
      case 'azure_blob':     return respond(await testAzureBlob(cleaned));
      case 's3':             return respond(await testS3(cleaned));
      case 'snowflake':      return respond(await testSnowflake(cleaned));
      case 'bigquery':       return respond(await testBigQuery(cleaned));
      case 'databricks':     return respond(await testDatabricks(cleaned));
      case 'fabric_lakehouse': return respond(await testFabricLakehouse(cleaned));
      case 'fabric_warehouse': return respond(await testFabricWarehouse(cleaned));
      case 'csv': {
        const fn = cleaned.filename || 'uploaded.csv';
        return respond({ ok: true, tables: [fn], message: `Local file "${fn}" registered.` });
      }
      case 'mysql':
      case 'sqlserver':
      case 'oracle':
      case 'mongodb':
      case 'redshift':
        return respond({
          ok: false,
          tables: [],
          reason: 'discovery_not_implemented',
          error: `Live discovery for ${sourceType} is not yet supported in this build. Currently supported: PostgreSQL, REST API, Azure Blob, S3, Snowflake, BigQuery, Databricks, Fabric Lakehouse, Fabric Warehouse, CSV.`,
        });
      default:
        return respond({ ok: false, tables: [], error: `Unknown source type: ${sourceType}` });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return respond({ ok: false, tables: [], error: msg }, 500);
  }
});
