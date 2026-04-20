import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Sparkles, Trash2, ChevronRight, CheckCircle2, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { AgentStep, ModuleId, DataSourceType, EntityNode, EntityEdge, CustomETLEntry, DeployPlatform } from '@/types/project';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import { callLLM, callLLMNonStreaming } from '@/lib/llm';
import { toast } from 'sonner';
import { useAutoFlow } from '@/hooks/useAutoFlow';

const MODULE_PROMPTS: Record<ModuleId, string[]> = {
  datasources: ['Connect to PostgreSQL', 'Add a Snowflake source', 'Connect to BigQuery', 'Add CSV file source'],
  profile: ['Profile this dataset', 'Show data quality issues', 'Infer primary keys', 'Find anomalies'],
  ontology: ['Suggest ontology', 'Add entity Customer', 'Add entity Order', 'Identify business entities'],
  mapping: ['Create source-to-target mapping', 'Suggest join logic', 'Map to canonical model', 'Review unmapped fields'],
  etl: ['Generate Bronze layer', 'Generate Silver layer', 'Generate Gold layer code', 'Add table dim_customer', 'Add view vw_revenue'],
  pipelines: ['Run bronze pipeline', 'Schedule daily refresh', 'Show pipeline status', 'Cancel running pipeline'],
  deploy: ['Deploy to Snowflake', 'Deploy to Databricks', 'Check readiness', 'Test connection to BigQuery', 'Show deploy status'],
  monitor: ['Show monitoring issues', 'Run validation checks', 'Summarize pipeline health', 'List unresolved warnings'],
  settings: ['Configure LLM model', 'Change default model', 'Test API connection'],
};

const AGENT_NAMES: Record<ModuleId, string> = {
  datasources: 'Data Sources Agent',
  profile: 'Profile Agent',
  ontology: 'Ontology Agent',
  mapping: 'Mapping Agent',
  etl: 'ETL Code Agent',
  pipelines: 'Pipelines Agent',
  deploy: 'Deploy Agent',
  monitor: 'Monitor Agent',
  settings: 'Settings Agent',
};

interface ConnectionParamDef {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  placeholder: string;
  defaultValue?: string;
}

const SOURCE_CONNECTION_PARAMS: Record<DataSourceType, { label: string; params: ConnectionParamDef[] }> = {
  postgresql: {
    label: 'PostgreSQL',
    params: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5432', defaultValue: '5432' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  mysql: {
    label: 'MySQL',
    params: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '3306', defaultValue: '3306' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'root' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  sqlserver: {
    label: 'SQL Server',
    params: [
      { key: 'host', label: 'Server', type: 'text', placeholder: 'server\\instance' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '1433', defaultValue: '1433' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'sa' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  oracle: {
    label: 'Oracle',
    params: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '1521', defaultValue: '1521' },
      { key: 'sid', label: 'SID / Service Name', type: 'text', placeholder: 'ORCL' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'system' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  snowflake: {
    label: 'Snowflake',
    params: [
      { key: 'account', label: 'Account Identifier', type: 'text', placeholder: 'org-account' },
      { key: 'warehouse', label: 'Warehouse', type: 'text', placeholder: 'COMPUTE_WH' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'MY_DB' },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'PUBLIC' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'user' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  bigquery: {
    label: 'BigQuery',
    params: [
      { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'my-gcp-project' },
      { key: 'dataset', label: 'Dataset', type: 'text', placeholder: 'my_dataset' },
      { key: 'credentials_json', label: 'Service Account Key (JSON)', type: 'text', placeholder: 'Paste JSON key...' },
    ],
  },
  redshift: {
    label: 'Amazon Redshift',
    params: [
      { key: 'host', label: 'Cluster Endpoint', type: 'text', placeholder: 'cluster.region.redshift.amazonaws.com' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5439', defaultValue: '5439' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'dev' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'awsuser' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  databricks: {
    label: 'Databricks',
    params: [
      { key: 'host', label: 'Workspace URL', type: 'text', placeholder: 'adb-xxx.azuredatabricks.net' },
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'dapi...' },
      { key: 'catalog', label: 'Catalog', type: 'text', placeholder: 'main' },
      { key: 'schema', label: 'Schema', type: 'text', placeholder: 'default' },
    ],
  },
  fabric_lakehouse: {
    label: 'Fabric Lakehouse',
    params: [
      { key: 'auth_type', label: 'Authentication Type', type: 'text', placeholder: 'sql_login | entra_id' },
      { key: 'workspace_id', label: 'Workspace ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'lakehouse_name', label: 'Lakehouse Name', type: 'text', placeholder: 'my_lakehouse' },
      { key: 'sql_endpoint', label: 'SQL Endpoint', type: 'text', placeholder: 'xxx.datawarehouse.fabric.microsoft.com' },
      // SQL Login fields
      { key: 'username', label: 'Username (SQL Login)', type: 'text', placeholder: 'sql_user' },
      { key: 'password', label: 'Password (SQL Login)', type: 'password', placeholder: '••••••••' },
      // Entra ID fields
      { key: 'tenant_id', label: 'Tenant ID (Entra ID)', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_id', label: 'Client ID (Entra ID)', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_secret', label: 'Client Secret (Entra ID)', type: 'password', placeholder: '••••••••' },
    ],
  },
  fabric_warehouse: {
    label: 'Fabric Warehouse',
    params: [
      { key: 'auth_type', label: 'Authentication Type', type: 'text', placeholder: 'sql_login | entra_id' },
      { key: 'workspace_id', label: 'Workspace ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'warehouse_name', label: 'Warehouse Name', type: 'text', placeholder: 'my_warehouse' },
      { key: 'sql_endpoint', label: 'SQL Endpoint', type: 'text', placeholder: 'xxx.datawarehouse.fabric.microsoft.com' },
      // SQL Login fields
      { key: 'username', label: 'Username (SQL Login)', type: 'text', placeholder: 'sql_user' },
      { key: 'password', label: 'Password (SQL Login)', type: 'password', placeholder: '••••••••' },
      // Entra ID fields
      { key: 'tenant_id', label: 'Tenant ID (Entra ID)', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_id', label: 'Client ID (Entra ID)', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { key: 'client_secret', label: 'Client Secret (Entra ID)', type: 'password', placeholder: '••••••••' },
    ],
  },
  csv: {
    label: 'CSV File',
    params: [
      { key: 'file_path', label: 'File Path', type: 'text', placeholder: 'C:\\data\\sales.csv' },
      { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',', defaultValue: ',' },
      { key: 'encoding', label: 'Encoding', type: 'text', placeholder: 'utf-8', defaultValue: 'utf-8' },
    ],
  },
  s3: {
    label: 'AWS S3',
    params: [
      { key: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'my-data-bucket' },
      { key: 'prefix', label: 'Prefix / Path', type: 'text', placeholder: 'data/raw/' },
      { key: 'access_key', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...' },
      { key: 'secret_key', label: 'Secret Access Key', type: 'password', placeholder: '••••••••' },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
    ],
  },
  azure_blob: {
    label: 'Azure Blob Storage',
    params: [
      { key: 'account_name', label: 'Storage Account', type: 'text', placeholder: 'mystorageaccount' },
      { key: 'container', label: 'Container', type: 'text', placeholder: 'data' },
      { key: 'connection_string', label: 'Connection String', type: 'password', placeholder: 'DefaultEndpointsProtocol=...' },
    ],
  },
  mongodb: {
    label: 'MongoDB',
    params: [
      { key: 'connection_string', label: 'Connection URI', type: 'text', placeholder: 'mongodb+srv://...' },
      { key: 'database', label: 'Database', type: 'text', placeholder: 'mydb' },
    ],
  },
  api: {
    label: 'REST API',
    params: [
      { key: 'url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com/v1' },
      { key: 'auth_header', label: 'Auth Header Value', type: 'password', placeholder: 'Bearer token...' },
      { key: 'method', label: 'Method', type: 'text', placeholder: 'GET', defaultValue: 'GET' },
    ],
  },
};

function detectSourceType(prompt: string): DataSourceType | null {
  const lower = prompt.toLowerCase();
  if (lower.includes('postgres') || lower.includes('postgresql') || lower.includes('pg')) return 'postgresql';
  if (lower.includes('mysql') || lower.includes('maria')) return 'mysql';
  if (lower.includes('sql server') || lower.includes('mssql') || lower.includes('sqlserver')) return 'sqlserver';
  if (lower.includes('oracle')) return 'oracle';
  if (lower.includes('snowflake')) return 'snowflake';
  if (lower.includes('bigquery') || lower.includes('big query')) return 'bigquery';
  if (lower.includes('redshift')) return 'redshift';
  if (lower.includes('databricks')) return 'databricks';
  if (lower.includes('fabric') && lower.includes('lakehouse')) return 'fabric_lakehouse';
  if (lower.includes('fabric') && lower.includes('warehouse')) return 'fabric_warehouse';
  if (lower.includes('fabric')) return 'fabric_warehouse';
  if (lower.includes('s3') || lower.includes('aws s3')) return 's3';
  if (lower.includes('azure') || lower.includes('blob')) return 'azure_blob';
  if (lower.includes('mongo')) return 'mongodb';
  if (lower.includes('api') || lower.includes('rest') || lower.includes('http')) return 'api';
  return null;
}

export default function AgentPanel() {
  const { agentMessages, addAgentMessage, updateAgentSteps, clearAgentMessages, agentPanelOpen, activeProjectId, activeModule, addDataSource, testDataSource, llmConfigs, addEntity, addEdge, getActiveProject, addActivity, addCustomETL, upsertPlatformConnection, addDeployRun, updateDeployRun, updateDeployStep, appendDeployLog, queuedAgentPrompt, clearQueuedAgentPrompt } = useAppStore();
  const autoFlow = useAutoFlow();
  const [input, setInput] = useState('');
  const [pendingSource, setPendingSource] = useState<{ type: DataSourceType; name: string } | null>(null);
  const [connectionForm, setConnectionForm] = useState<Record<string, string>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Resizable panel width (persisted)
  const MIN_W = 380;
  const MAX_W = 900;
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('agentPanelWidth') : null;
    const n = stored ? parseInt(stored, 10) : NaN;
    if (Number.isFinite(n)) return Math.min(Math.max(n, MIN_W), MAX_W);
    const def = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.4) : 480;
    return Math.min(Math.max(def, MIN_W), MAX_W);
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const newW = Math.min(Math.max(window.innerWidth - e.clientX, MIN_W), MAX_W);
      setPanelWidth(newW);
    };
    const onUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  useEffect(() => {
    localStorage.setItem('agentPanelWidth', String(panelWidth));
  }, [panelWidth]);
  const defaultLLM = llmConfigs.find(c => c.isDefault) || llmConfigs[0];
  const queuedPromptProcessed = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentMessages]);

  const handleConnectionSubmit = () => {
    if (!pendingSource) return;
    const srcConfig = SOURCE_CONNECTION_PARAMS[pendingSource.type];
    const dsId = uuid();

    addDataSource({
      id: dsId,
      name: pendingSource.name || `${srcConfig.label} Source`,
      type: pendingSource.type,
      status: 'disconnected',
      connectionParams: { ...connectionForm },
    });

    addAgentMessage({
      agent: AGENT_NAMES['datasources'],
      agentIcon: '🤖',
      type: 'workflow',
      content: `Testing connection to ${srcConfig.label}...`,
      steps: [
        { id: '1', label: 'Validating parameters', status: 'done' },
        { id: '2', label: 'Establishing connection', status: 'running' },
        { id: '3', label: 'Discovering tables', status: 'pending' },
      ],
    });

    // Simulate connection test
    setTimeout(() => {
      testDataSource(dsId);

      setTimeout(() => {
        const state = useAppStore.getState();
        const project = state.projects.find(p => p.id === state.activeProjectId);
        const ds = project?.dataSources.find(d => d.id === dsId);
        const connected = ds?.status === 'connected';

        if (connected) {
          toast.success(`Connected to ${srcConfig.label}`, { description: `${ds?.tables?.length || 0} tables discovered` });
          // Kick off the seamless profile → ontology auto-flow
          if ((ds?.tables?.length || 0) > 0) {
            void autoFlow.runForSource(dsId);
          }
        } else {
          toast.error(`${srcConfig.label} connection failed`, { description: ds?.errorMessage || 'Check host, credentials, and network access' });
        }

        addAgentMessage({
          agent: AGENT_NAMES['datasources'],
          agentIcon: '🤖',
          type: connected ? 'result' : 'error',
          content: connected
            ? `✅ Successfully connected to ${srcConfig.label}!\n\n━━ Connection Details ━━━━━━━━━\n• Name: ${pendingSource.name}\n• Type: ${srcConfig.label}\n• Status: Connected\n• Tables discovered: ${ds?.tables?.length || 0}\n\n🚀 Auto-building your ontology now — profiling tables and generating entities & relationships. Watch the progress toast.`
            : `❌ Connection failed\n\n━━ Error ━━━━━━━━━━━━━━━━━━\n${ds?.errorMessage || 'Unknown error'}\n\nPlease check your connection parameters and try again.`,
        });
      }, 2000);
    }, 500);

    setPendingSource(null);
    setConnectionForm({});
  };

  const simulateAgent = useCallback(async (prompt: string) => {
    const agentName = AGENT_NAMES[activeModule];

    // Add user message
    addAgentMessage({ agent: 'User', agentIcon: '👤', type: 'user', content: prompt });

    // Data sources module: detect source type and present connection form
    if (activeModule === 'datasources') {
      const sourceType = detectSourceType(prompt);
      if (sourceType) {
        const srcConfig = SOURCE_CONNECTION_PARAMS[sourceType];
        const defaultForm: Record<string, string> = {};
        srcConfig.params.forEach(p => { if (p.defaultValue) defaultForm[p.key] = p.defaultValue; });
        setConnectionForm(defaultForm);
        setPendingSource({ type: sourceType, name: `My ${srcConfig.label}` });

        setTimeout(() => {
          addAgentMessage({
            agent: agentName,
            agentIcon: '🤖',
            type: 'result',
            content: `🔌 ${srcConfig.label} Connection Setup\n\nI've detected you want to connect to a ${srcConfig.label} source. Please fill in the connection parameters below and click "Connect" to test the connection.\n\n━━ Required Parameters ━━━━━━━━\n${srcConfig.params.map(p => `• ${p.label}`).join('\n')}`,
          });
        }, 600);
        return;
      } else if (!defaultLLM) {
        setTimeout(() => {
          addAgentMessage({
            agent: agentName,
            agentIcon: '🤖',
            type: 'result',
            content: `🔌 Available Data Source Types\n\nI couldn't determine the source type from your description. Please specify one of these:\n\n━━ Databases ━━━━━━━━━━━━━━━━\n• PostgreSQL\n• MySQL\n• SQL Server\n• Oracle\n• Snowflake\n• BigQuery\n• Redshift\n• Databricks\n\n━━ Files & Storage ━━━━━━━━━━━\n• CSV File\n• AWS S3\n• Azure Blob Storage\n\n━━ Other ━━━━━━━━━━━━━━━━━━━\n• MongoDB\n• REST API\n\nTry: "Connect to PostgreSQL" or "Add a Snowflake source"`,
          });
        }, 400);
        return;
      }
    }

    // Ontology module: detect "add entity" intent
    if (activeModule === 'ontology' && defaultLLM) {
      const addEntityMatch = prompt.match(/add\s+(?:entity|node)\s+(.+)/i);
      if (addEntityMatch) {
        const entityName = addEntityMatch[1].trim().replace(/^["']|["']$/g, '');
        setIsStreaming(true);

        addAgentMessage({
          agent: agentName,
          agentIcon: '🤖',
          type: 'workflow',
          content: `Adding entity "${entityName}" and detecting relationships...`,
          steps: [
            { id: '1', label: `Creating entity "${entityName}"`, status: 'running' },
            { id: '2', label: 'Detecting relationships with AI', status: 'pending' },
          ],
        });

        try {
          const project = getActiveProject();
          // Ask LLM to infer tables, attributes, and relationships
          const tablesCtx = project?.tables.length
            ? project.tables.map(t => `Table "${t.name}": ${t.columns.map(c => `${c.name}(${c.datatype}${c.isKey ? ', PK' : ''})`).join(', ')}`).join('\n')
            : '';
          const existingEntities = project?.entities.length
            ? project.entities.map(e => `Entity "${e.label}": tables=[${e.tables.join(', ')}], attributes=[${e.attributes.join(', ')}]`).join('\n')
            : '';

          const inferResult = await callLLMNonStreaming(defaultLLM, 'ontology',
            `Create a new entity called "${entityName}" for this data model.
${tablesCtx ? `\nAvailable tables:\n${tablesCtx}` : ''}
${existingEntities ? `\nExisting entities:\n${existingEntities}` : ''}

Return EXACTLY this JSON (no other text):
{"tables":["table1"],"attributes":["attr1","attr2"],"confidence":0.92,"relationships":[{"target":"ExistingEntity","label":"verb","type":"parent-child|contains|related","confidence":0.9}]}

Rules:
- tables: source tables that map to this entity (from available tables, or suggest names)
- attributes: key business attributes for this entity
- relationships: only to existing entities, type must be parent-child, contains, or related
- If no existing entities, set relationships to []`,
            [],
          );

          // Parse
          const jsonMatch = inferResult.match(/\{[\s\S]*\}/);
          let tables: string[] = [];
          let attributes: string[] = [];
          let confidence = 0.9;
          let relationships: { target: string; label: string; type: 'parent-child' | 'related' | 'contains'; confidence: number }[] = [];

          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              tables = Array.isArray(parsed.tables) ? parsed.tables : [];
              attributes = Array.isArray(parsed.attributes) ? parsed.attributes : [];
              confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.9;
              relationships = Array.isArray(parsed.relationships) ? parsed.relationships.filter((r: any) =>
                r.target && r.label && ['parent-child', 'contains', 'related'].includes(r.type)
              ) : [];
            } catch { /* use defaults */ }
          }

          // Add entity
          const entityId = uuid();
          addEntity({
            id: entityId,
            label: entityName,
            tables,
            attributes,
            confidence,
          });

          // Update steps
          const msgs = useAppStore.getState().agentMessages;
          const wfMsg = msgs[msgs.length - 1];
          if (wfMsg?.steps) {
            useAppStore.setState({
              agentMessages: msgs.map((m, i) =>
                i === msgs.length - 1
                  ? { ...m, steps: [
                      { id: '1', label: `Creating entity "${entityName}"`, status: 'done' as const },
                      { id: '2', label: 'Detecting relationships with AI', status: 'running' as const },
                    ]}
                  : m
              ),
            });
          }

          // Add relationships
          const currentProject = useAppStore.getState().projects.find(p => p.id === useAppStore.getState().activeProjectId);
          let addedRels = 0;
          relationships.forEach(rel => {
            const targetEntity = currentProject?.entities.find(e => e.label === rel.target);
            if (targetEntity) {
              addEdge({
                id: uuid(),
                source: entityId,
                target: targetEntity.id,
                label: rel.label,
                type: rel.type as 'parent-child' | 'related' | 'contains',
                confidence: rel.confidence,
              });
              addedRels++;
            }
          });

          addActivity({ action: `Added entity "${entityName}" via AI Agent`, module: 'ontology' });

          // Final result message
          const msgs2 = useAppStore.getState().agentMessages;
          useAppStore.setState({
            agentMessages: msgs2.map((m, i) =>
              i === msgs2.length - 1
                ? {
                    ...m,
                    type: 'result' as const,
                    steps: undefined,
                    content: `✅ Entity "${entityName}" added successfully!

━━ Entity Details ━━━━━━━━━━━━━
• Name: ${entityName}
• Tables: ${tables.length > 0 ? tables.join(', ') : 'none assigned'}
• Attributes: ${attributes.length > 0 ? attributes.join(', ') : 'none'}
• Confidence: ${Math.round(confidence * 100)}%

━━ Relationships ━━━━━━━━━━━━━━
${addedRels > 0
  ? relationships.filter(r => currentProject?.entities.some(e => e.label === r.target)).map(r =>
      `• ${entityName} → ${r.target} (${r.label}, ${r.type}, ${Math.round(r.confidence * 100)}%)`
    ).join('\n')
  : '• No relationships detected (add more entities first)'}

The entity is now visible in the Ontology graph.`,
                  }
                : m
            ),
          });
        } catch (err: any) {
          toast.error('Failed to add entity', { description: err.message });
          const msgs = useAppStore.getState().agentMessages;
          useAppStore.setState({
            agentMessages: msgs.map((m, i) =>
              i === msgs.length - 1
                ? { ...m, type: 'error' as const, content: `❌ Failed to add entity: ${err.message}`, steps: undefined }
                : m
            ),
          });
        } finally {
          setIsStreaming(false);
        }
        return;
      }
    }

    // ETL module: detect "add table/view" intent
    if (activeModule === 'etl' && defaultLLM) {
      const addTableMatch = prompt.match(/add\s+(?:(table|view)\s+)?(.+)/i);
      if (addTableMatch) {
        const objectType = (addTableMatch[1]?.toLowerCase() === 'view' ? 'view' : 'table') as 'table' | 'view';
        const objectName = addTableMatch[2].trim().replace(/^["']|["']$/g, '');
        setIsStreaming(true);

        addAgentMessage({
          agent: agentName,
          agentIcon: '🤖',
          type: 'workflow',
          content: `Creating ${objectType} "${objectName}" with AI-generated ETL code...`,
          steps: [
            { id: '1', label: `Analyzing project context`, status: 'running' },
            { id: '2', label: `Generating ETL code for all targets`, status: 'pending' },
            { id: '3', label: `Adding to project`, status: 'pending' },
          ],
        });

        try {
          const project = getActiveProject();
          const tablesCtx = project?.tables.length
            ? project.tables.map(t => `Table "${t.name}": ${t.columns.map(c => `${c.name}(${c.datatype}${c.isKey ? ', PK' : ''})`).join(', ')}`).join('\n')
            : '';

          // Determine best layer
          const layerResult = await callLLMNonStreaming(defaultLLM, 'etl',
            `Given ${objectType} "${objectName}", which ETL layer is most appropriate: bronze, silver, or gold? Return ONLY one word: bronze, silver, or gold.`,
            [],
          );
          const detectedLayer = (['bronze', 'silver', 'gold'].find(l => layerResult.toLowerCase().includes(l)) || 'silver') as 'bronze' | 'silver' | 'gold';

          // Update steps
          const msgs1 = useAppStore.getState().agentMessages;
          useAppStore.setState({
            agentMessages: msgs1.map((m, i) =>
              i === msgs1.length - 1
                ? { ...m, steps: [
                    { id: '1', label: `Analyzing project context`, status: 'done' as const },
                    { id: '2', label: `Generating ETL code (${detectedLayer} layer)`, status: 'running' as const },
                    { id: '3', label: `Adding to project`, status: 'pending' as const },
                  ]}
                : m
            ),
          });

          const targetDefs = [
            { id: 'sql_snowflake', desc: 'Snowflake SQL', lang: 'SQL' },
            { id: 'sql_bigquery', desc: 'BigQuery Standard SQL', lang: 'SQL' },
            { id: 'sql_redshift', desc: 'Amazon Redshift SQL', lang: 'SQL' },
            { id: 'pyspark_databricks', desc: 'PySpark for Databricks', lang: 'PySpark' },
            { id: 'pyspark_fabric', desc: 'PySpark for Microsoft Fabric', lang: 'PySpark' },
          ];

          const codeMap: Record<string, string> = {};
          for (const t of targetDefs) {
            const result = await callLLMNonStreaming(defaultLLM, 'etl',
              `Generate production-ready ${t.lang} code in ${t.desc} to CREATE ${objectType === 'view' ? 'VIEW' : 'TABLE'} "${objectName}" for the ${detectedLayer} layer. Based on the source tables, generate full DDL/ETL code with comments. Output ONLY the code.`,
              tablesCtx ? [{ role: 'user' as const, content: `Source Tables:\n${tablesCtx}` }, { role: 'assistant' as const, content: 'Understood.' }] : [],
            );
            codeMap[t.id] = result;
          }

          // Update steps
          const msgs2 = useAppStore.getState().agentMessages;
          useAppStore.setState({
            agentMessages: msgs2.map((m, i) =>
              i === msgs2.length - 1
                ? { ...m, steps: [
                    { id: '1', label: `Analyzing project context`, status: 'done' as const },
                    { id: '2', label: `Generating ETL code (${detectedLayer} layer)`, status: 'done' as const },
                    { id: '3', label: `Adding to project`, status: 'running' as const },
                  ]}
                : m
            ),
          });

          const entry: CustomETLEntry = {
            id: uuid(),
            name: objectName,
            objectType,
            description: `Created via AI Agent`,
            layer: detectedLayer,
            code: codeMap,
            createdAt: new Date().toISOString(),
          };

          addCustomETL(entry);
          addActivity({ action: `Added ${objectType} "${objectName}" via AI Agent`, module: 'etl' });

          // Final message
          const msgs3 = useAppStore.getState().agentMessages;
          useAppStore.setState({
            agentMessages: msgs3.map((m, i) =>
              i === msgs3.length - 1
                ? {
                    ...m,
                    type: 'result' as const,
                    steps: undefined,
                    content: `✅ ${objectType === 'view' ? 'View' : 'Table'} "${objectName}" created!

━━ Details ━━━━━━━━━━━━━━━━━━
• Name: ${objectName}
• Type: ${objectType.toUpperCase()}
• Layer: ${detectedLayer}
• Targets: Snowflake, BigQuery, Redshift, Databricks, Fabric

ETL code has been generated for all 5 target platforms. Switch to the ETL Code module to view and export the code.`,
                  }
                : m
            ),
          });
        } catch (err: any) {
          toast.error('LLM inference failed', { description: err.message });
          const msgs = useAppStore.getState().agentMessages;
          useAppStore.setState({
            agentMessages: msgs.map((m, i) =>
              i === msgs.length - 1
                ? { ...m, type: 'error' as const, content: `❌ Failed to create ${objectType}: ${err.message}`, steps: undefined }
                : m
            ),
          });
        } finally {
          setIsStreaming(false);
        }
        return;
      }
    }

    // Deploy module: detect deploy commands
    if (activeModule === 'deploy') {
      const lower = prompt.toLowerCase();
      const project = getActiveProject();

      // Detect platform from prompt
      const detectPlatform = (text: string): DeployPlatform | null => {
        const l = text.toLowerCase();
        if (l.includes('snowflake')) return 'snowflake';
        if (l.includes('databricks')) return 'databricks';
        if (l.includes('fabric')) return 'fabric';
        if (l.includes('bigquery') || l.includes('big query')) return 'bigquery';
        if (l.includes('redshift')) return 'redshift';
        return null;
      };

      // "check readiness" / "show status"
      if (lower.includes('check readiness') || lower.includes('readiness') || lower.includes('show status') || lower.includes('deploy status')) {
        const deploy = project?.deploy;
        const passCount = deploy?.readiness.filter(r => r.status === 'pass').length || 0;
        const totalChecks = deploy?.readiness.length || 0;
        const connections = (deploy?.platformConnections || []).filter(c => c.status === 'connected');
        const runs = (deploy?.deployRuns || []);
        const lastRun = runs[runs.length - 1];

        addAgentMessage({
          agent: agentName,
          agentIcon: '🤖',
          type: 'result',
          content: `📊 Deployment Readiness Report

━━ Readiness Checks ━━━━━━━━━━
${deploy?.readiness.map(r => `${r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏳'} ${r.check}`).join('\n') || 'No checks configured'}

Score: ${passCount}/${totalChecks} passed

━━ Platform Connections ━━━━━━━
${connections.length > 0 ? connections.map(c => `✅ ${c.platform} — Connected`).join('\n') : '⚠️ No platforms connected'}

━━ Deployment History ━━━━━━━━━
Total runs: ${runs.length}
Successful: ${runs.filter(r => r.status === 'completed').length}
Failed: ${runs.filter(r => r.status === 'failed').length}
${lastRun ? `Last run: ${lastRun.platform} — ${lastRun.status} (${new Date(lastRun.startedAt).toLocaleString()})` : 'No deployments yet'}

━━ Project Stats ━━━━━━━━━━━━━
• Tables: ${project?.tables.length || 0}
• Entities: ${project?.entities.length || 0}
• Mappings: ${project?.mappings.length || 0} (${project?.mappings.filter(m => m.approved).length || 0} approved)
• Custom ETL: ${(project?.customETL || []).length}
• Open Issues: ${project?.validations.filter(v => !v.resolved).length || 0}`,
        });
        return;
      }

      // "test connection to X"
      const testConnMatch = lower.match(/test\s+connection\s+(?:to\s+)?(.+)/i);
      if (testConnMatch) {
        const platform = detectPlatform(testConnMatch[1]);
        if (platform) {
          const conn = (project?.deploy.platformConnections || []).find(c => c.platform === platform);
          if (!conn) {
            addAgentMessage({
              agent: agentName,
              agentIcon: '🤖',
              type: 'error',
              content: `⚠️ No connection configured for ${platform}.\n\nGo to the Deploy module and configure connection parameters for ${platform} first.`,
            });
          } else {
            addAgentMessage({
              agent: agentName,
              agentIcon: '🤖',
              type: 'workflow',
              content: `Testing connection to ${platform}...`,
              steps: [
                { id: '1', label: 'Validating credentials', status: 'running' },
                { id: '2', label: 'Establishing connection', status: 'pending' },
              ],
            });

            upsertPlatformConnection({ ...conn, status: 'testing' });

            setTimeout(() => {
              const success = Math.random() > 0.15;
              upsertPlatformConnection({
                ...conn,
                status: success ? 'connected' : 'error',
                lastTested: new Date().toISOString(),
                errorMessage: success ? undefined : 'Connection timed out — verify credentials and network access',
              });

              const msgs = useAppStore.getState().agentMessages;
              useAppStore.setState({
                agentMessages: msgs.map((m, i) =>
                  i === msgs.length - 1
                    ? {
                        ...m,
                        type: (success ? 'result' : 'error') as any,
                        steps: undefined,
                        content: success
                          ? `✅ Connection to ${platform} successful!\n\n━━ Connection Details ━━━━━━━━━\n• Platform: ${platform}\n• Status: Connected\n• Tested: ${new Date().toLocaleString()}\n\nYou can now deploy to ${platform}.`
                          : `❌ Connection to ${platform} failed!\n\n━━ Error ━━━━━━━━━━━━━━━━━━\nConnection timed out — verify credentials and network access.\n\nPlease check your connection parameters in the Deploy module.`,
                      }
                    : m
                ),
              });
            }, 2000);
          }
          return;
        }
      }

      // "deploy to X"
      const deployMatch = lower.match(/deploy\s+(?:to\s+)?(.+)/i);
      if (deployMatch) {
        const platform = detectPlatform(deployMatch[1]);
        if (platform && project) {
          const conn = (project.deploy.platformConnections || []).find(c => c.platform === platform);

          if (!conn || conn.status !== 'connected') {
            addAgentMessage({
              agent: agentName,
              agentIcon: '🤖',
              type: 'error',
              content: `⚠️ Cannot deploy to ${platform}\n\n${!conn ? 'No connection configured.' : `Connection status: ${conn.status}.`}\n\nPlease configure and test the connection first:\n• Go to Deploy module → Select ${platform}\n• Fill in connection parameters\n• Click "Test Connection"\n• Or say "test connection to ${platform}"`,
            });
            return;
          }

          setIsStreaming(true);
          addAgentMessage({
            agent: agentName,
            agentIcon: '🤖',
            type: 'workflow',
            content: `Deploying to ${platform}...`,
            steps: [
              { id: '1', label: 'Validating project', status: 'running' },
              { id: '2', label: 'Connecting to platform', status: 'pending' },
              { id: '3', label: 'Generating DDL', status: 'pending' },
              { id: '4', label: 'Deploying pipelines', status: 'pending' },
              { id: '5', label: 'Verifying deployment', status: 'pending' },
            ],
          });

          const runId = uuid();
          const deploySteps = [
            { id: 'validate', label: 'Validate project readiness', status: 'pending' as const },
            { id: 'connect', label: 'Test platform connection', status: 'pending' as const },
            { id: 'gen_ddl', label: 'Generate DDL scripts', status: 'pending' as const },
            { id: 'deploy_ddl', label: 'Deploy tables & views', status: 'pending' as const },
            { id: 'deploy_bronze', label: 'Deploy Bronze pipelines', status: 'pending' as const },
            { id: 'deploy_silver', label: 'Deploy Silver pipelines', status: 'pending' as const },
            { id: 'deploy_gold', label: 'Deploy Gold pipelines', status: 'pending' as const },
            { id: 'verify', label: 'Verify deployment', status: 'pending' as const },
          ];

          addDeployRun({
            id: runId,
            platform,
            status: 'running',
            steps: deploySteps,
            startedAt: new Date().toISOString(),
            logs: [],
          });

          const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
          const stepLabels = ['Validating project', 'Connecting to platform', 'Generating DDL', 'Deploying pipelines', 'Verifying deployment'];

          try {
            // Simulate deployment steps
            for (let i = 0; i < deploySteps.length; i++) {
              const step = deploySteps[i];
              updateDeployStep(runId, step.id, { status: 'running', startedAt: new Date().toISOString() });
              appendDeployLog(runId, `▶ Starting: ${step.label}`);

              // Update agent workflow steps
              const agentStepIdx = i < 2 ? i : i < 4 ? 2 : i < 7 ? 3 : 4;
              const msgs = useAppStore.getState().agentMessages;
              useAppStore.setState({
                agentMessages: msgs.map((m, idx) =>
                  idx === msgs.length - 1
                    ? { ...m, steps: stepLabels.map((s, si) => ({ id: String(si + 1), label: s, status: si < agentStepIdx ? 'done' as const : si === agentStepIdx ? 'running' as const : 'pending' as const })) }
                    : m
                ),
              });

              await delay(800 + Math.random() * 700);

              updateDeployStep(runId, step.id, { status: 'done', completedAt: new Date().toISOString(), detail: 'OK' });
              appendDeployLog(runId, `✓ Completed: ${step.label}`);
            }

            updateDeployRun(runId, { status: 'completed', completedAt: new Date().toISOString() });
            appendDeployLog(runId, `═══ Deployment to ${platform} completed successfully ═══`);
            addActivity({ action: `Deployed to ${platform} via AI Agent`, module: 'deploy' });

            // Final success message
            const msgs = useAppStore.getState().agentMessages;
            useAppStore.setState({
              agentMessages: msgs.map((m, i) =>
                i === msgs.length - 1
                  ? {
                      ...m,
                      type: 'result' as const,
                      steps: undefined,
                      content: `✅ Deployment to ${platform} completed!

━━ Deployment Summary ━━━━━━━━
• Platform: ${platform}
• Tables deployed: ${project.tables.length}
• Entities: ${project.entities.length}
• Custom ETL objects: ${(project.customETL || []).length}
• Status: All steps passed

━━ Pipeline Layers ━━━━━━━━━━━
• Bronze: Deployed ✓
• Silver: Deployed ✓
• Gold: Deployed ✓

Deployment is now visible in the Deploy module history.`,
                    }
                  : m
              ),
            });
          } catch (err: any) {
            toast.error('Deployment failed', { description: err.message });
            updateDeployRun(runId, { status: 'failed', completedAt: new Date().toISOString() });
            const msgs = useAppStore.getState().agentMessages;
            useAppStore.setState({
              agentMessages: msgs.map((m, i) =>
                i === msgs.length - 1
                  ? { ...m, type: 'error' as const, steps: undefined, content: `❌ Deployment failed: ${err.message}` }
                  : m
              ),
            });
          } finally {
            setIsStreaming(false);
          }
          return;
        }
      }
    }

    if (!defaultLLM) {
      addAgentMessage({
        agent: agentName,
        agentIcon: '🤖',
        type: 'error',
        content: '⚠️ No LLM model configured.\n\nGo to the Settings module to add your LLM API URL and token, then set it as default.',
      });
      return;
    }

    // Real LLM call with streaming
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // Build conversation history from recent messages
    const history = agentMessages
      .filter(m => m.type === 'user' || m.type === 'result')
      .slice(-10)
      .map(m => ({
        role: (m.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    // Add thinking message
    const thinkingId = uuid();
    addAgentMessage({
      agent: agentName,
      agentIcon: '🤖',
      type: 'workflow',
      content: '',
      steps: [
        { id: '1', label: `Calling ${defaultLLM.name} (${defaultLLM.modelName})`, status: 'running' },
      ],
    });

    let accumulated = '';
    const currentMsgId = () => {
      const msgs = useAppStore.getState().agentMessages;
      return msgs[msgs.length - 1]?.id;
    };

    await callLLM(
      defaultLLM,
      activeModule,
      prompt,
      history,
      {
        onToken: (token) => {
          accumulated += token;
          // Update the last message with streamed content
          const msgs = useAppStore.getState().agentMessages;
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.type === 'workflow') {
            // Replace workflow message with result type showing streamed content
            useAppStore.setState({
              agentMessages: msgs.map((m, i) =>
                i === msgs.length - 1
                  ? { ...m, type: 'result' as const, content: accumulated, steps: undefined }
                  : m
              ),
            });
          } else if (lastMsg && lastMsg.agent !== 'User') {
            useAppStore.setState({
              agentMessages: msgs.map((m, i) =>
                i === msgs.length - 1 ? { ...m, content: accumulated } : m
              ),
            });
          }
        },
        onDone: () => {
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setIsStreaming(false);
          abortRef.current = null;
          toast.error('LLM inference error', { description: error });
          // If we haven't streamed anything, replace the last message with error
          if (!accumulated) {
            const msgs = useAppStore.getState().agentMessages;
            useAppStore.setState({
              agentMessages: msgs.map((m, i) =>
                i === msgs.length - 1
                  ? { ...m, type: 'error' as const, content: `❌ LLM Error\n\n${error}`, steps: undefined }
                  : m
              ),
            });
          } else {
            addAgentMessage({
              agent: agentName,
              agentIcon: '🤖',
              type: 'error',
              content: `⚠️ Stream interrupted: ${error}`,
            });
          }
        },
      },
      controller.signal,
    );
  }, [activeModule, addAgentMessage, agentMessages, defaultLLM, upsertPlatformConnection, addDeployRun, updateDeployRun, updateDeployStep, appendDeployLog, addActivity, getActiveProject]);

  // Auto-send queued prompt from source tile clicks
  useEffect(() => {
    if (queuedAgentPrompt && agentPanelOpen && !queuedPromptProcessed.current) {
      queuedPromptProcessed.current = true;
      const prompt = queuedAgentPrompt;
      clearQueuedAgentPrompt();
      setTimeout(() => {
        simulateAgent(prompt);
        queuedPromptProcessed.current = false;
      }, 300);
    }
  }, [queuedAgentPrompt, agentPanelOpen, simulateAgent, clearQueuedAgentPrompt]);

  const handleSend = (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');
    simulateAgent(text.trim());
  };

  if (!agentPanelOpen) return null;

  const prompts = MODULE_PROMPTS[activeModule] || [];

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: panelWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={isResizing ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
      className="relative border-l border-border bg-card/50 glass flex flex-col shrink-0 overflow-hidden"
    >
      {/* Resize handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onDoubleClick={() => setPanelWidth(Math.min(Math.max(Math.round(window.innerWidth * 0.4), MIN_W), MAX_W))}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group hover:bg-primary/30 transition-colors',
          isResizing && 'bg-primary/40'
        )}
        title="Drag to resize · Double-click to reset"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-primary transition-colors" />
      </div>
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-agent flex items-center justify-center glow-agent">
            <Bot className="w-3.5 h-3.5 text-agent-foreground" />
          </div>
          <div>
            <span className="text-sm font-semibold">{AGENT_NAMES[activeModule]}</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
              <span className="text-[10px] text-muted-foreground">Active</span>
            </div>
          </div>
        </div>
        <button onClick={clearAgentMessages} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* No LLM warning */}
      {!defaultLLM && (
        <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-xs text-destructive shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>No LLM configured. Go to <strong>Settings</strong> to add one.</span>
        </div>
      )}

      {/* Active model indicator */}
      {defaultLLM && (
        <div className="px-3 py-1.5 bg-primary/5 border-b border-border flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="font-mono truncate">{defaultLLM.name} — {defaultLLM.modelName}</span>
        </div>
      )}


      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {agentMessages.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl gradient-agent mx-auto mb-4 flex items-center justify-center glow-agent">
              <Sparkles className="w-7 h-7 text-agent-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">AI Agent Ready</p>
            <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
              Ask me to analyze, suggest, generate, or validate across your data project
            </p>
          </motion.div>
        )}
        <AnimatePresence>
          {agentMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "rounded-lg text-sm",
                msg.type === 'user' && "bg-secondary/80 p-3 ml-10",
                msg.type === 'workflow' && "bg-muted/50 border border-border p-3",
                msg.type === 'result' && "bg-card border border-primary/20 p-3 glow-primary",
                msg.type === 'error' && "bg-destructive/10 border border-destructive/20 p-3",
              )}
            >
              {msg.type !== 'user' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs">{msg.agentIcon}</span>
                  <span className="text-xs font-mono text-muted-foreground">{msg.agent}</span>
                  {msg.type === 'workflow' && <Loader2 className="w-3 h-3 text-agent animate-spin ml-auto" />}
                </div>
              )}
              {msg.steps && (
                <div className="space-y-1.5 mb-2">
                  {msg.steps.map((step) => (
                    <div key={step.id} className="flex items-center gap-2 text-xs">
                      {step.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                      {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                      {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                      {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <span className={cn(
                        step.status === 'done' ? 'text-muted-foreground' : step.status === 'running' ? 'text-foreground' : 'text-muted-foreground/50'
                      )}>{step.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{msg.content}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Connection Form (shown when pending source) */}
      {pendingSource && (
        <div className="p-3 border-t border-border space-y-3 shrink-0 bg-muted/30 max-h-[45%] overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {SOURCE_CONNECTION_PARAMS[pendingSource.type].label} Connection
            </span>
            <button
              onClick={() => { setPendingSource(null); setConnectionForm({}); }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">Source Name</label>
              <input
                value={pendingSource.name}
                onChange={(e) => setPendingSource({ ...pendingSource, name: e.target.value })}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="My Database"
              />
            </div>
            {/* Auth type toggle for Fabric */}
            {(pendingSource.type === 'fabric_lakehouse' || pendingSource.type === 'fabric_warehouse') && (
              <div>
                <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1.5 block">Authentication Type</label>
                <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
                  {[
                    { value: 'sql_login', label: 'SQL Login' },
                    { value: 'entra_id', label: 'Microsoft Entra ID' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setConnectionForm({ ...connectionForm, auth_type: opt.value })}
                      className={cn(
                        'flex-1 text-[11px] px-2 py-1.5 rounded-md transition-all font-medium',
                        (connectionForm.auth_type || 'sql_login') === opt.value
                          ? 'bg-primary/15 text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {SOURCE_CONNECTION_PARAMS[pendingSource.type].params
              .filter((param) => {
                // For Fabric sources, conditionally show auth-specific fields
                if (pendingSource.type !== 'fabric_lakehouse' && pendingSource.type !== 'fabric_warehouse') return true;
                if (param.key === 'auth_type') return false; // handled by toggle above
                const authType = connectionForm.auth_type || 'sql_login';
                const sqlLoginKeys = ['username', 'password'];
                const entraIdKeys = ['tenant_id', 'client_id', 'client_secret'];
                if (authType === 'sql_login' && entraIdKeys.includes(param.key)) return false;
                if (authType === 'entra_id' && sqlLoginKeys.includes(param.key)) return false;
                return true;
              })
              .map((param) => (
              <div key={param.key}>
                <label className="text-[10px] text-muted-foreground font-mono uppercase mb-1 block">{param.label}</label>
                <input
                  type={param.type}
                  value={connectionForm[param.key] || ''}
                  onChange={(e) => setConnectionForm({ ...connectionForm, [param.key]: e.target.value })}
                  placeholder={param.placeholder}
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!pendingSource) return;
                const srcConfig = SOURCE_CONNECTION_PARAMS[pendingSource.type];
                // Check that all params have a value
                const missing = srcConfig.params.filter(p => {
                  if (pendingSource.type === 'fabric_lakehouse' || pendingSource.type === 'fabric_warehouse') {
                    if (p.key === 'auth_type') return false;
                    const at = connectionForm.auth_type || 'sql_login';
                    if (at === 'sql_login' && ['tenant_id', 'client_id', 'client_secret'].includes(p.key)) return false;
                    if (at === 'entra_id' && ['username', 'password'].includes(p.key)) return false;
                  }
                  return !connectionForm[p.key]?.trim();
                });
                if (missing.length) {
                  toast.error('Missing required fields', { description: missing.map(m => m.label).join(', ') });
                  return;
                }
                // Create a transient test source, run test, then remove if user doesn't save
                const testId = uuid();
                addDataSource({
                  id: testId,
                  name: `__test__${pendingSource.name}`,
                  type: pendingSource.type,
                  status: 'testing',
                  connectionParams: { ...connectionForm },
                });
                toast.info(`Testing ${srcConfig.label} connection…`);
                testDataSource(testId);
                setTimeout(() => {
                  const state = useAppStore.getState();
                  const project = state.projects.find(p => p.id === state.activeProjectId);
                  const ds = project?.dataSources.find(d => d.id === testId);
                  if (ds?.status === 'connected') {
                    toast.success(`Connection successful`, {
                      description: `${ds.tables?.length || 0} table${ds.tables?.length === 1 ? '' : 's'} discovered`,
                    });
                  } else {
                    toast.error(`Connection failed`, { description: ds?.errorMessage || 'Check parameters and try again' });
                  }
                  // Clean up test source
                  useAppStore.getState().removeDataSource(testId);
                }, 1700);
              }}
              className="flex-1 py-2 rounded-lg border border-primary/40 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
            >
              Test Connection
            </button>
            <button
              onClick={handleConnectionSubmit}
              className="flex-1 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary hover:opacity-90 transition-opacity"
            >
              Connect & Save
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      {activeProjectId && (
        <div className="p-3 border-t border-border space-y-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors flex items-center gap-1"
              >
                <ChevronRight className="w-2.5 h-2.5 text-primary" />
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="Ask the agent..."
              className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-colors"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isStreaming}
              className={cn(
                "p-2.5 rounded-lg transition-all",
                input.trim() && !isStreaming ? "gradient-primary text-primary-foreground glow-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
