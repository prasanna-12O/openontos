import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Project, TableSchema, EntityNode, EntityEdge, MappingItem, ValidationIssue, AgentMessage, AgentStep, ModuleId, ActivityEntry, DataSource, LLMConfig, PlatformConnection, DeployRun, PipelineRun, PipelineSchedule } from '@/types/project';
import { v4 as uuid } from 'uuid';
import { createElectronStorage } from '@/lib/storage';
import { DEMO_PROJECT } from '@/data/demoProject';

const normalizeDiscoveredTables = (tables: string[] | undefined): string[] => {
  if (!tables?.length) return [];
  return Array.from(new Set(tables.map((table) => table.trim()).filter(Boolean)));
};

interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  activeModule: ModuleId;
  agentMessages: AgentMessage[];
  agentPanelOpen: boolean;
  queuedAgentPrompt: string | null;
  sidebarCollapsed: boolean;
  llmConfigs: LLMConfig[];

  setActiveModule: (m: ModuleId) => void;
  toggleAgentPanel: () => void;
  openAgentWithPrompt: (prompt: string) => void;
  clearQueuedAgentPrompt: () => void;
  toggleSidebar: () => void;
  addAgentMessage: (msg: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
  updateAgentSteps: (msgId: string, steps: AgentStep[]) => void;
  clearAgentMessages: () => void;

  createProject: (name: string, description: string, industryType?: string, subjectArea?: string) => string;
  setActiveProject: (id: string | null) => void;
  getActiveProject: () => Project | undefined;

  addTable: (table: TableSchema) => void;
  updateTable: (id: string, table: Partial<TableSchema>) => void;
  addEntity: (entity: EntityNode) => void;
  addEdge: (edge: EntityEdge) => void;
  updateEntities: (entities: EntityNode[], edges: EntityEdge[]) => void;
  addMapping: (m: MappingItem) => void;
  approveMapping: (id: string) => void;
  addValidation: (v: ValidationIssue) => void;
  resolveValidation: (id: string) => void;
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  addDataSource: (ds: DataSource) => void;
  removeDataSource: (id: string) => void;
  testDataSource: (id: string) => Promise<void>;
  updateDataSource: (id: string, updates: Partial<DataSource>) => void;
  addCustomETL: (entry: import('@/types/project').CustomETLEntry) => void;
  removeCustomETL: (id: string) => void;
  updateCustomETLCode: (id: string, target: string, code: string) => void;

  upsertPlatformConnection: (conn: PlatformConnection) => void;
  addDeployRun: (run: DeployRun) => void;
  updateDeployRun: (runId: string, updates: Partial<DeployRun>) => void;
  updateDeployStep: (runId: string, stepId: string, updates: Partial<import('@/types/project').DeployStep>) => void;
  appendDeployLog: (runId: string, log: string) => void;

  addPipelineRun: (run: PipelineRun) => void;
  updatePipelineRun: (runId: string, updates: Partial<PipelineRun>) => void;
  appendPipelineLog: (runId: string, log: string) => void;
  addPipelineSchedule: (schedule: PipelineSchedule) => void;
  removePipelineSchedule: (id: string) => void;
  togglePipelineSchedule: (id: string) => void;

  addLLMConfig: (config: LLMConfig) => void;
  updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => void;
  removeLLMConfig: (id: string) => void;
  setDefaultLLMConfig: (id: string) => void;
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  projects: [DEMO_PROJECT],
  activeProjectId: DEMO_PROJECT.id,
  activeModule: 'datasources',
  agentMessages: [],
  agentPanelOpen: false,
  queuedAgentPrompt: null,
  sidebarCollapsed: false,
  llmConfigs: [],

  setActiveModule: (m) => set({ activeModule: m }),
  toggleAgentPanel: () => set((s) => ({ agentPanelOpen: !s.agentPanelOpen })),
  openAgentWithPrompt: (prompt) => set({ agentPanelOpen: true, queuedAgentPrompt: prompt }),
  clearQueuedAgentPrompt: () => set({ queuedAgentPrompt: null }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addAgentMessage: (msg) => set((s) => ({
    agentMessages: [...s.agentMessages, { ...msg, id: uuid(), timestamp: new Date().toISOString() }],
  })),
  updateAgentSteps: (msgId, steps) => set((s) => ({
    agentMessages: s.agentMessages.map(m => m.id === msgId ? { ...m, steps } : m),
  })),
  clearAgentMessages: () => set({ agentMessages: [] }),

  createProject: (name, description, industryType = '', subjectArea = '') => {
    const id = uuid();
    const now = new Date().toISOString();
    const project: Project = {
      id, name, description, industryType, subjectArea,
      createdAt: now, updatedAt: now,
      dataSources: [], tables: [], entities: [], edges: [], mappings: [], validations: [],
      pipelines: {
        bronze: { sql_snowflake: '', sql_bigquery: '', sql_redshift: '', pyspark_databricks: '', pyspark_fabric: '' },
        silver: { sql_snowflake: '', sql_bigquery: '', sql_redshift: '', pyspark_databricks: '', pyspark_fabric: '' },
        gold: { sql_snowflake: '', sql_bigquery: '', sql_redshift: '', pyspark_databricks: '', pyspark_fabric: '' },
      },
      customETL: [],
      deploy: { platform: '', readiness: [], exported: false, platformConnections: [], deployRuns: [] },
      pipelineRuns: [],
      pipelineSchedules: [],
      activity: [{ id: uuid(), action: 'Project created', module: 'profile', timestamp: now }],
    };
    set((s) => ({ projects: [...s.projects, project], activeProjectId: id, activeModule: 'profile' }));
    return id;
  },

  setActiveProject: (id) => set({ activeProjectId: id, activeModule: id ? 'datasources' : 'datasources' }),
  getActiveProject: () => {
    const s = get();
    return s.projects.find(p => p.id === s.activeProjectId);
  },

  addTable: (table) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, tables: [...p.tables, table], updatedAt: new Date().toISOString() } : p
    ),
  })),

  updateTable: (id, updates) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, tables: p.tables.map(t => t.id === id ? { ...t, ...updates } : t), updatedAt: new Date().toISOString() }
        : p
    ),
  })),

  addEntity: (entity) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, entities: [...p.entities, entity], updatedAt: new Date().toISOString() } : p
    ),
  })),

  addEdge: (edge) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, edges: [...p.edges, edge], updatedAt: new Date().toISOString() } : p
    ),
  })),

  updateEntities: (entities, edges) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, entities, edges, updatedAt: new Date().toISOString() } : p
    ),
  })),

  addMapping: (m) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, mappings: [...p.mappings, m], updatedAt: new Date().toISOString() } : p
    ),
  })),

  approveMapping: (id) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, mappings: p.mappings.map(m => m.id === id ? { ...m, approved: true } : m) }
        : p
    ),
  })),

  addValidation: (v) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, validations: [...p.validations, v], updatedAt: new Date().toISOString() } : p
    ),
  })),

  resolveValidation: (id) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, validations: p.validations.map(v => v.id === id ? { ...v, resolved: true } : v) }
        : p
    ),
  })),

  addActivity: (entry) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, activity: [...p.activity, { ...entry, id: uuid(), timestamp: new Date().toISOString() }] }
        : p
    ),
  })),

  addDataSource: (ds) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, dataSources: [...p.dataSources, ds], updatedAt: new Date().toISOString() } : p
    ),
  })),

  removeDataSource: (id) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, dataSources: p.dataSources.filter(d => d.id !== id), updatedAt: new Date().toISOString() } : p
    ),
  })),

  testDataSource: async (id) => {
    // Mark as testing immediately
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? { ...p, dataSources: p.dataSources.map(d => d.id === id ? { ...d, status: 'testing' as const, errorMessage: undefined } : d) }
          : p
      ),
    }));

    // Find the source
    const stateBefore = useAppStore.getState();
    const projectBefore = stateBefore.projects.find(p => p.id === stateBefore.activeProjectId);
    const ds = projectBefore?.dataSources.find(d => d.id === id);
    if (!ds) return;

    // Call the real edge function — no more simulation
    let result: { ok: boolean; tables: string[]; error?: string; reason?: string; message?: string };
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('test-source-connection', {
        body: {
          sourceType: ds.type,
          connectionParams: ds.connectionParams || {},
        },
      });
      if (error) {
        result = { ok: false, tables: [], error: error.message || 'Edge function call failed' };
      } else {
        const parsed = data as typeof result;
        result = { ...parsed, tables: normalizeDiscoveredTables(parsed.tables) };
      }
    } catch (e) {
      result = { ok: false, tables: [], error: e instanceof Error ? e.message : String(e) };
    }

    set((s) => ({
      projects: s.projects.map(p =>
        p.id === s.activeProjectId
          ? {
              ...p,
              dataSources: p.dataSources.map(d =>
                d.id === id
                  ? {
                      ...d,
                      status: result.ok ? 'connected' as const : 'error' as const,
                      lastTested: new Date().toISOString(),
                      errorMessage: result.ok ? undefined : (result.error || 'Connection failed'),
                       tables: result.ok ? result.tables : [],
                    }
                  : d
              ),
            }
          : p
      ),
    }));
  },

  updateDataSource: (id, updates) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, dataSources: p.dataSources.map(d => d.id === id ? { ...d, ...updates } : d) }
        : p
    ),
  })),

  addCustomETL: (entry) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, customETL: [...(p.customETL || []), entry], updatedAt: new Date().toISOString() } : p
    ),
  })),
  removeCustomETL: (id) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, customETL: (p.customETL || []).filter(e => e.id !== id), updatedAt: new Date().toISOString() } : p
    ),
  })),
  updateCustomETLCode: (id, target, code) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, customETL: (p.customETL || []).map(e => e.id === id ? { ...e, code: { ...e.code, [target]: code } } : e), updatedAt: new Date().toISOString() }
        : p
    ),
  })),

  upsertPlatformConnection: (conn) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? {
            ...p,
            deploy: {
              ...p.deploy,
              platformConnections: p.deploy.platformConnections.some(c => c.platform === conn.platform)
                ? p.deploy.platformConnections.map(c => c.platform === conn.platform ? conn : c)
                : [...p.deploy.platformConnections, conn],
            },
            updatedAt: new Date().toISOString(),
          }
        : p
    ),
  })),
  addDeployRun: (run) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, deploy: { ...p.deploy, deployRuns: [...(p.deploy.deployRuns || []), run] }, updatedAt: new Date().toISOString() }
        : p
    ),
  })),
  updateDeployRun: (runId, updates) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, deploy: { ...p.deploy, deployRuns: (p.deploy.deployRuns || []).map(r => r.id === runId ? { ...r, ...updates } : r) } }
        : p
    ),
  })),
  updateDeployStep: (runId, stepId, updates) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? {
            ...p,
            deploy: {
              ...p.deploy,
              deployRuns: (p.deploy.deployRuns || []).map(r =>
                r.id === runId
                  ? { ...r, steps: r.steps.map(st => st.id === stepId ? { ...st, ...updates } : st) }
                  : r
              ),
            },
          }
        : p
    ),
  })),
  appendDeployLog: (runId, log) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? {
            ...p,
            deploy: {
              ...p.deploy,
              deployRuns: (p.deploy.deployRuns || []).map(r =>
                r.id === runId ? { ...r, logs: [...r.logs, `[${new Date().toLocaleTimeString()}] ${log}`] } : r
              ),
            },
          }
        : p
    ),
  })),

  addPipelineRun: (run) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, pipelineRuns: [...(p.pipelineRuns || []), run], updatedAt: new Date().toISOString() } : p
    ),
  })),
  updatePipelineRun: (runId, updates) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, pipelineRuns: (p.pipelineRuns || []).map(r => r.id === runId ? { ...r, ...updates } : r) }
        : p
    ),
  })),
  appendPipelineLog: (runId, log) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, pipelineRuns: (p.pipelineRuns || []).map(r => r.id === runId ? { ...r, logs: [...r.logs, `[${new Date().toLocaleTimeString()}] ${log}`] } : r) }
        : p
    ),
  })),
  addPipelineSchedule: (schedule) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, pipelineSchedules: [...(p.pipelineSchedules || []), schedule], updatedAt: new Date().toISOString() } : p
    ),
  })),
  removePipelineSchedule: (id) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId ? { ...p, pipelineSchedules: (p.pipelineSchedules || []).filter(s => s.id !== id) } : p
    ),
  })),
  togglePipelineSchedule: (id) => set((s) => ({
    projects: s.projects.map(p =>
      p.id === s.activeProjectId
        ? { ...p, pipelineSchedules: (p.pipelineSchedules || []).map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) }
        : p
    ),
  })),
  addLLMConfig: (config) => set((s) => ({ llmConfigs: [...s.llmConfigs, config] })),
  updateLLMConfig: (id, updates) => set((s) => ({
    llmConfigs: s.llmConfigs.map(c => c.id === id ? { ...c, ...updates } : c),
  })),
  removeLLMConfig: (id) => set((s) => ({
    llmConfigs: s.llmConfigs.filter(c => c.id !== id).map((c, _, arr) =>
      arr.length > 0 && !arr.some(x => x.isDefault) && arr[0].id === c.id ? { ...c, isDefault: true } : c
    ),
  })),
  setDefaultLLMConfig: (id) => set((s) => ({
    llmConfigs: s.llmConfigs.map(c => ({ ...c, isDefault: c.id === id })),
  })),
}), {
  name: 'openontos-state',
  version: 3,
  storage: createJSONStorage(createElectronStorage),
  migrate: (persistedState: any, version) => {
    // v2 → v3: restore the bundled demo project for users whose state was purged.
    if (version < 3 && persistedState && Array.isArray(persistedState.projects)) {
      const hasDemo = persistedState.projects.some((p: any) => p?.id === DEMO_PROJECT.id);
      if (!hasDemo) {
        persistedState.projects = [DEMO_PROJECT, ...persistedState.projects];
      }
      if (!persistedState.activeProjectId) {
        persistedState.activeProjectId = DEMO_PROJECT.id;
      }
    }
    return persistedState;
  },
  partialize: (state) => ({
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    activeModule: state.activeModule,
    sidebarCollapsed: state.sidebarCollapsed,
    llmConfigs: state.llmConfigs,
  } as unknown as AppState),
}));
