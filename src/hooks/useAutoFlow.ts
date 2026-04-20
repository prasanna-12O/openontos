import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '@/store/useAppStore';
import { useLLM } from '@/hooks/useLLM';
import { supabase } from '@/integrations/supabase/client';
import type {
  ColumnProfile,
  DataSource,
  EntityNode,
  EntityEdge,
  TableSchema,
} from '@/types/project';

/**
 * Orchestrates the seamless flow:
 *   connected source  →  profile every discovered table  →  generate ontology  →  navigate to Ontology
 *
 * Progress is reported via a single sonner toast that updates per step.
 * The flow is idempotent per source — subsequent runs reuse existing tables
 * (matched by `${sourceName} → ${tableName}`).
 */

interface SourceSampleResult {
  supported: boolean;
  columns: string[];
  rows: unknown[][];
  error?: string;
  reason?: string;
}

const stringifyCell = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const inferDatatype = (values: string[]): string => {
  const norm = values.map(v => v.trim()).filter(Boolean);
  if (!norm.length) return 'VARCHAR';
  if (norm.every(v => /^(true|false)$/i.test(v))) return 'BOOLEAN';
  if (norm.every(v => /^-?\d+$/.test(v))) return 'INTEGER';
  if (norm.every(v => /^-?\d+(\.\d+)?$/.test(v))) return 'DECIMAL';
  if (norm.every(v => !Number.isNaN(Date.parse(v)))) return 'TIMESTAMP';
  return 'VARCHAR';
};

const buildColumnProfiles = (sample: SourceSampleResult): ColumnProfile[] =>
  sample.columns.map((name, idx) => {
    const values = sample.rows.map(r => stringifyCell(r[idx]));
    const nonNull = values.filter(v => v.trim() !== '');
    const nullCount = values.length - nonNull.length;
    const uniqueCount = new Set(nonNull).size;
    const nullPercent = Math.round((nullCount / Math.max(values.length, 1)) * 1000) / 10;
    const uniquePercent = Math.round((uniqueCount / Math.max(nonNull.length, 1)) * 1000) / 10;
    const anomalies: string[] = [];
    if (nullPercent >= 10) anomalies.push(`${nullPercent}% null rate in sample`);
    return {
      name,
      datatype: inferDatatype(nonNull),
      nullPercent,
      uniquePercent,
      sampleValues: nonNull.slice(0, 3),
      isKey: nonNull.length > 0 && uniqueCount === nonNull.length && nullCount === 0,
      anomalies: anomalies.length ? anomalies : undefined,
    };
  });

const getDisplayTableName = (tableName: string, sourceType: DataSource['type']): string => {
  if (sourceType === 'azure_blob' || sourceType === 's3' || sourceType === 'csv') {
    return tableName.split('/').pop() || tableName;
  }
  return tableName;
};

export function useAutoFlow() {
  const { addTable, updateTable, updateEntities, addActivity, setActiveModule } = useAppStore();
  const llm = useLLM('ontology');
  const runningRef = useRef<Set<string>>(new Set());

  const runForSource = useCallback(async (sourceId: string) => {
    // Guard: don't run twice for the same source concurrently
    if (runningRef.current.has(sourceId)) return;
    runningRef.current.add(sourceId);

    const toastId = `autoflow-${sourceId}`;

    try {
      const state = useAppStore.getState();
      const project = state.projects.find(p => p.id === state.activeProjectId);
      const ds = project?.dataSources.find(d => d.id === sourceId);
      if (!project || !ds) return;
      const tables = ds.tables || [];
      if (tables.length === 0) return;

      // Step 1: register all discovered tables (or reuse existing)
      const existingBySource = new Map(project.tables.map(t => [t.source, t]));
      const importTargets = tables.map(tableName => {
        const sourceLabel = `${ds.name} → ${tableName}`;
        const existing = existingBySource.get(sourceLabel);
        const tableId = existing?.id || uuid();
        const next: TableSchema = {
          id: tableId,
          name: getDisplayTableName(tableName, ds.type),
          source: sourceLabel,
          columns: existing?.columns || [],
          rowCount: existing?.rowCount || 0,
          profiledAt: existing?.profiledAt,
        };
        if (existing) updateTable(tableId, next);
        else addTable(next);
        return { tableId, tableName };
      });

      // Step 2: profile each table in parallel
      toast.loading(`Profiling ${importTargets.length} table${importTargets.length === 1 ? '' : 's'} from ${ds.name}…`, {
        id: toastId,
        description: 'Step 1 of 2 — fetching samples and inferring schema',
      });

      let profiledCount = 0;
      const results = await Promise.allSettled(
        importTargets.map(async ({ tableId, tableName }) => {
          const { data, error } = await supabase.functions.invoke('fetch-source-sample', {
            body: {
              sourceType: ds.type,
              table: tableName,
              connectionParams: ds.connectionParams || {},
              limit: 50,
            },
          });
          if (error) throw new Error(error.message || `Could not profile ${tableName}`);
          const sample = data as SourceSampleResult;
          if (!sample.supported) throw new Error(sample.reason || `Live profiling not supported for ${tableName}`);
          if (sample.error) throw new Error(sample.error);
          updateTable(tableId, {
            columns: buildColumnProfiles(sample),
            rowCount: sample.rows.length,
            profiledAt: new Date().toISOString(),
          });
          profiledCount++;
        }),
      );

      const failedCount = results.length - profiledCount;
      if (profiledCount === 0) {
        toast.error('Profiling failed', {
          id: toastId,
          description: 'Could not fetch sample data from any discovered table.',
        });
        return;
      }

      // Step 3: generate ontology from profiled tables
      const latestProject = useAppStore.getState().projects.find(p => p.id === useAppStore.getState().activeProjectId);
      if (!latestProject || latestProject.tables.length === 0) return;

      toast.loading(`Generating ontology from ${latestProject.tables.length} profiled table${latestProject.tables.length === 1 ? '' : 's'}…`, {
        id: toastId,
        description: `Step 2 of 2 — AI is designing entities and relationships${failedCount ? ` (${failedCount} table${failedCount === 1 ? '' : 's'} skipped)` : ''}`,
      });

      const tablesCtx = latestProject.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c => `${c.name}(${c.datatype}${c.isKey ? ', PK' : ''})`).join(', ')}`,
      ).join('\n');

      const prompt = `You are a senior data architect. Based on the profiled source tables below, design a clean business ontology (conceptual model).

PROFILED TABLES:
${tablesCtx}

Industry: ${latestProject.industryType || 'general'}
Subject area: ${latestProject.subjectArea || 'general'}

Rules:
- Identify 3-10 distinct business entities (e.g. Customer, Order, Product). Group related tables under one entity when appropriate.
- Each entity must reference at least one source table from the list above.
- Pick the most meaningful attributes (5-10 max per entity), preferably keys and business-relevant columns.
- Identify relationships between entities. Use type "parent-child" for one-to-many, "contains" for composition, "related" for general associations.
- Confidence is a number 0-1 reflecting how strongly the data supports this.

Respond with ONLY a JSON object in this exact shape (no markdown, no commentary):
{
  "entities": [
    {"label": "Customer", "tables": ["customers"], "attributes": ["customer_id","name","email"], "confidence": 0.95}
  ],
  "edges": [
    {"source": "Customer", "target": "Order", "label": "places", "type": "parent-child", "confidence": 0.9}
  ]
}`;

      const result = await llm.generate(prompt, '');

      // Robust JSON extraction
      let parsed: any = null;
      const fenced = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenced ? fenced[1] : result;
      const objMatch = candidate.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]); } catch { /* noop */ }
      }
      if (!parsed || !Array.isArray(parsed.entities)) {
        toast.error('Ontology generation produced invalid output', {
          id: toastId,
          description: 'Profiling succeeded — open Ontology and click "Generate from Profile" to retry.',
        });
        return;
      }

      const labelToId = new Map<string, string>();
      const newEntities: EntityNode[] = parsed.entities
        .filter((e: any) => e && typeof e.label === 'string' && e.label.trim())
        .map((e: any) => {
          const id = uuid();
          labelToId.set(e.label.trim().toLowerCase(), id);
          return {
            id,
            label: e.label.trim(),
            tables: Array.isArray(e.tables) ? e.tables.filter(Boolean).map(String) : [],
            attributes: Array.isArray(e.attributes) ? e.attributes.filter(Boolean).map(String) : [],
            confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.85,
          } as EntityNode;
        });

      const newEdges: EntityEdge[] = (Array.isArray(parsed.edges) ? parsed.edges : [])
        .map((edge: any) => {
          const sId = labelToId.get(String(edge?.source || '').toLowerCase());
          const tId = labelToId.get(String(edge?.target || '').toLowerCase());
          if (!sId || !tId || sId === tId) return null;
          return {
            id: uuid(),
            source: sId,
            target: tId,
            label: String(edge.label || 'related'),
            type: (['parent-child', 'contains', 'related'].includes(edge.type) ? edge.type : 'related') as EntityEdge['type'],
            confidence: typeof edge.confidence === 'number' ? Math.min(1, Math.max(0, edge.confidence)) : 0.85,
          };
        })
        .filter(Boolean) as EntityEdge[];

      updateEntities(newEntities, newEdges);
      addActivity({
        action: `Auto-flow: profiled ${profiledCount} tables, generated ${newEntities.length} entities & ${newEdges.length} relationships`,
        module: 'ontology',
        details: `Triggered from data source "${ds.name}"`,
      });

      // Step 4: navigate to ontology so the user lands on the result
      setActiveModule('ontology');

      toast.success('Ontology ready', {
        id: toastId,
        description: `${profiledCount} tables profiled · ${newEntities.length} entities · ${newEdges.length} relationships`,
        duration: 5000,
      });
    } catch (err) {
      toast.error('Auto-flow failed', {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unexpected error during profiling/generation.',
      });
    } finally {
      runningRef.current.delete(sourceId);
    }
  }, [addTable, updateTable, updateEntities, addActivity, setActiveModule, llm]);

  return { runForSource };
}
