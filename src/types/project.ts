export interface ColumnProfile {
  name: string;
  datatype: string;
  nullPercent: number;
  uniquePercent: number;
  sampleValues: string[];
  distribution?: { value: string; count: number }[];
  isKey?: boolean;
  anomalies?: string[];
  description?: string;
}

export interface TableSchema {
  id: string;
  name: string;
  source: string;
  columns: ColumnProfile[];
  rowCount: number;
  profiledAt?: string;
}

export interface EntityNode {
  id: string;
  label: string;
  tables: string[];
  attributes: string[];
  confidence: number;
}

export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'parent-child' | 'related' | 'contains';
  confidence: number;
}

export interface MappingItem {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetEntity: string;
  targetAttribute: string;
  transformLogic: string;
  confidence: number;
  approved: boolean;
}

export interface ValidationIssue {
  id: string;
  type: 'missing_join' | 'low_confidence' | 'data_quality' | 'unmapped' | 'deployment';
  severity: 'error' | 'warning' | 'info';
  message: string;
  details: string;
  module: ModuleId;
  resolved: boolean;
  timestamp: string;
}

export interface PipelineCode {
  sql_snowflake: string;
  sql_bigquery: string;
  sql_redshift: string;
  pyspark_databricks: string;
  pyspark_fabric: string;
}

export interface CustomETLEntry {
  id: string;
  name: string;
  objectType: 'table' | 'view';
  description: string;
  layer: 'bronze' | 'silver' | 'gold';
  code: Record<string, string>;
  createdAt: string;
}

export type DeployPlatform = 'snowflake' | 'databricks' | 'fabric' | 'bigquery' | 'redshift';

export interface PlatformConnection {
  platform: DeployPlatform;
  credentials: Record<string, string>;
  status: 'disconnected' | 'testing' | 'connected' | 'error';
  lastTested?: string;
  errorMessage?: string;
}

export interface DeployStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DeployRun {
  id: string;
  platform: DeployPlatform;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: DeployStep[];
  startedAt: string;
  completedAt?: string;
  scriptsGenerated?: string[];
  logs: string[];
}

export interface DeployConfig {
  platform: string;
  readiness: { check: string; status: 'pass' | 'fail' | 'pending' }[];
  exported: boolean;
  platformConnections: PlatformConnection[];
  deployRuns: DeployRun[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  module: ModuleId;
  timestamp: string;
  details?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  industryType: string;
  subjectArea: string;
  createdAt: string;
  updatedAt: string;
  dataSources: DataSource[];
  tables: TableSchema[];
  entities: EntityNode[];
  edges: EntityEdge[];
  mappings: MappingItem[];
  validations: ValidationIssue[];
  pipelines: {
    bronze: PipelineCode;
    silver: PipelineCode;
    gold: PipelineCode;
  };
  customETL: CustomETLEntry[];
  deploy: DeployConfig;
  pipelineRuns: PipelineRun[];
  pipelineSchedules: PipelineSchedule[];
  activity: ActivityEntry[];
}

export interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export interface AgentMessage {
  id: string;
  agent: string;
  agentIcon: string;
  type: 'thinking' | 'result' | 'user' | 'error' | 'workflow';
  content: string;
  timestamp: string;
  steps?: AgentStep[];
}

export type ModuleId = 'datasources' | 'profile' | 'ontology' | 'mapping' | 'etl' | 'pipelines' | 'deploy' | 'monitor' | 'settings';

export interface PipelineRun {
  id: string;
  name: string;
  platform: DeployPlatform;
  layer: 'bronze' | 'silver' | 'gold' | 'custom';
  objectName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  rowsProcessed?: number;
  errorMessage?: string;
  logs: string[];
}

export interface PipelineSchedule {
  id: string;
  name: string;
  platform: DeployPlatform;
  layers: ('bronze' | 'silver' | 'gold')[];
  cron: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface LLMConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  modelName: string;
  isDefault: boolean;
}

export type DataSourceType = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'snowflake' | 'bigquery' | 'redshift' | 'databricks' | 'fabric_lakehouse' | 'fabric_warehouse' | 'csv' | 's3' | 'azure_blob' | 'mongodb' | 'api';

export interface DataSourceConnectionParam {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  placeholder: string;
  required: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  connectionParams: Record<string, string>;
  lastTested?: string;
  errorMessage?: string;
  tables?: string[];
}
