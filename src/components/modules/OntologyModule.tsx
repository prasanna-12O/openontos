import { useMemo, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  ConnectionMode,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '@/store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Sparkles, ArrowRight, Loader2, Plus, X, Wand2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLLM } from '@/hooks/useLLM';
import { v4 as uuid } from 'uuid';
import type { EntityNode, EntityEdge } from '@/types/project';

const TYPE_COLORS: Record<string, string> = {
  'parent-child': 'hsl(200, 85%, 55%)',
  'contains': 'hsl(175, 65%, 48%)',
  'related': 'hsl(270, 65%, 62%)',
};

const TYPE_LABELS: Record<string, string> = {
  'parent-child': 'Parent → Child',
  'contains': 'Contains',
  'related': 'Related',
};

const TYPE_DASH: Record<string, string> = {
  'parent-child': '0',
  'contains': '6 3',
  'related': '3 3',
};

function EntityNodeComponent({ data }: { data: { label: string; tables: string[]; attributes: string[]; confidence: number } }) {
  const handleStyle = {
    width: 12,
    height: 12,
    background: 'hsl(200, 85%, 55%)',
    border: '2px solid hsl(225, 25%, 12%)',
  } as const;
  return (
    <div className="bg-card border-2 border-primary/30 rounded-xl px-5 py-4 min-w-[180px] shadow-xl glow-primary relative">
      <Handle type="target" position={Position.Top} id="t" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="l" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="r" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="b" style={handleStyle} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-foreground">{data.label}</span>
        <span className={cn(
          "text-[9px] font-mono px-1.5 py-0.5 rounded-full",
          data.confidence >= 0.95 ? "bg-success/20 text-success" :
          data.confidence >= 0.9 ? "bg-primary/20 text-primary" :
          "bg-warning/20 text-warning"
        )}>{Math.round(data.confidence * 100)}%</span>
      </div>
      <div className="space-y-1 mb-2">
        {data.tables.map((t: string) => (
          <div key={t} className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{t}</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {data.attributes.slice(0, 4).map((a: string) => (
          <span key={a} className="text-[9px] text-primary/70 font-mono">{a}</span>
        ))}
        {data.attributes.length > 4 && (
          <span className="text-[9px] text-muted-foreground">+{data.attributes.length - 4}</span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { entity: EntityNodeComponent };

interface AddEntityForm {
  label: string;
  tables: string;
  attributes: string;
}

const EMPTY_FORM: AddEntityForm = { label: '', tables: '', attributes: '' };

export default function OntologyModule() {
  const { getActiveProject, addEntity, addEdge, addActivity, updateEntities } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('ontology');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddEntityForm>(EMPTY_FORM);
  const [addingEntity, setAddingEntity] = useState(false);
  const [aiRelationships, setAiRelationships] = useState<{ target: string; label: string; type: 'parent-child' | 'related' | 'contains'; confidence: number }[]>([]);
  const [pendingConnection, setPendingConnection] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [relForm, setRelForm] = useState<{ label: string; type: 'parent-child' | 'related' | 'contains' }>({ label: '', type: 'related' });

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.source !== connection.target) {
      setPendingConnection({ sourceId: connection.source, targetId: connection.target });
      setRelForm({ label: '', type: 'related' });
    }
  }, []);

  const handleConfirmRelationship = useCallback(() => {
    if (!pendingConnection || !relForm.label.trim()) return;
    addEdge({
      id: uuid(),
      source: pendingConnection.sourceId,
      target: pendingConnection.targetId,
      label: relForm.label.trim(),
      type: relForm.type,
      confidence: 1.0,
    });
    addActivity({ action: `Added relationship: ${relForm.label}`, module: 'ontology' });
    setPendingConnection(null);
  }, [pendingConnection, relForm, addEdge, addActivity]);

  const handleAiSuggestOntology = useCallback(async () => {
    if (!project || !llm.isConfigured) return;
    setSuggestLoading(true);
    setAiSuggestion(null);
    try {
      if (project.tables.length === 0) {
        setAiSuggestion('No profiled tables yet. Add and profile data sources first, then click AI Suggest to auto-generate entities and relationships.');
        return;
      }

      const tablesCtx = project.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c => `${c.name}(${c.datatype}${c.isKey ? ', PK' : ''})`).join(', ')}`
      ).join('\n');
      const existingCtx = project.entities.length > 0
        ? `\n\nExisting entities (avoid duplicating):\n${project.entities.map(e => `- ${e.label}`).join('\n')}`
        : '';

      const prompt = `You are a senior data architect. Suggest a business ontology based on the profiled source tables below.

PROFILED TABLES:
${tablesCtx}${existingCtx}

Industry: ${project.industryType || 'general'}
Subject area: ${project.subjectArea || 'general'}

Rules:
- Suggest 3-8 distinct business entities. Each must reference at least one source table from the list above.
- 5-10 most meaningful attributes per entity (prefer keys & business-relevant columns).
- Suggest relationships between entities. Type: "parent-child" (one-to-many), "contains" (composition), "related" (general).
- Confidence is 0-1, reflecting evidence in the data.

Respond with ONLY a JSON object (no markdown, no commentary):
{
  "entities": [
    {"label":"Customer","tables":["customers"],"attributes":["customer_id","name","email"],"confidence":0.95}
  ],
  "edges": [
    {"source":"Customer","target":"Order","label":"places","type":"parent-child","confidence":0.9}
  ]
}`;

      const result = await llm.generate(prompt, '');

      let parsed: any = null;
      const fenced = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenced ? fenced[1] : result;
      const objMatch = candidate.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]); } catch { /* noop */ }
      }
      if (!parsed || !Array.isArray(parsed.entities)) {
        setAiSuggestion(`AI returned an unexpected format. Raw response:\n\n${result}`);
        return;
      }

      // Build label -> id map seeded with existing entities (case-insensitive)
      const labelToId = new Map<string, string>();
      project.entities.forEach(e => labelToId.set(e.label.toLowerCase(), e.id));

      // Add new entities directly to the graph (skip duplicates by label)
      let entitiesAdded = 0;
      parsed.entities.forEach((e: any) => {
        if (!e || typeof e.label !== 'string' || !e.label.trim()) return;
        const label = e.label.trim();
        const key = label.toLowerCase();
        if (labelToId.has(key)) return;
        const id = uuid();
        labelToId.set(key, id);
        addEntity({
          id,
          label,
          tables: Array.isArray(e.tables) ? e.tables.filter(Boolean).map(String) : [],
          attributes: Array.isArray(e.attributes) ? e.attributes.filter(Boolean).map(String) : [],
          confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.85,
        });
        entitiesAdded++;
      });

      // Add edges that resolve to known entities
      let edgesAdded = 0;
      const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
      rawEdges.forEach((edge: any) => {
        if (!edge) return;
        const sId = labelToId.get(String(edge.source || '').toLowerCase());
        const tId = labelToId.get(String(edge.target || '').toLowerCase());
        if (!sId || !tId || sId === tId) return;
        addEdge({
          id: uuid(),
          source: sId,
          target: tId,
          label: String(edge.label || 'related'),
          type: (['parent-child', 'contains', 'related'].includes(edge.type) ? edge.type : 'related') as 'parent-child' | 'contains' | 'related',
          confidence: typeof edge.confidence === 'number' ? Math.min(1, Math.max(0, edge.confidence)) : 0.85,
        });
        edgesAdded++;
      });

      addActivity({
        action: `AI Suggest applied: ${entitiesAdded} entities, ${edgesAdded} relationships`,
        module: 'ontology',
        details: `From ${project.tables.length} profiled tables`,
      });

      if (entitiesAdded === 0 && edgesAdded === 0) {
        setAiSuggestion('AI Suggest produced no new additions — your ontology already contains the suggested entities.');
      }
    } catch (err: any) {
      setAiSuggestion(`Error: ${err.message}`);
    } finally {
      setSuggestLoading(false);
    }
  }, [project, llm, addEntity, addEdge, addActivity]);

  const handleGenerateOntology = useCallback(async () => {
    if (!project || !llm.isConfigured) return;
    if (project.tables.length === 0) {
      setGenerateError('No profiled tables. Run "Import & Profile" in the Profile module first.');
      return;
    }
    setGenerateLoading(true);
    setGenerateError(null);
    try {
      const tablesCtx = project.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c => `${c.name}(${c.datatype}${c.isKey ? ', PK' : ''})`).join(', ')}`
      ).join('\n');

      const prompt = `You are a senior data architect. Based on the profiled source tables below, design a clean business ontology (conceptual model).

PROFILED TABLES:
${tablesCtx}

Industry: ${project.industryType || 'general'}
Subject area: ${project.subjectArea || 'general'}

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

      // Extract JSON object
      let parsed: any = null;
      const fenced = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenced ? fenced[1] : result;
      const objMatch = candidate.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]); } catch { /* noop */ }
      }
      if (!parsed || !Array.isArray(parsed.entities)) {
        throw new Error('AI returned an unexpected format. Please try again.');
      }

      // Build entities with stable ids and map labels -> ids for edge resolution
      const labelToId = new Map<string, string>();
      const newEntities: EntityNode[] = parsed.entities
        .filter((e: any) => e && typeof e.label === 'string' && e.label.trim())
        .map((e: any) => {
          const id = uuid();
          labelToId.set(e.label.trim(), id);
          return {
            id,
            label: e.label.trim(),
            tables: Array.isArray(e.tables) ? e.tables.filter(Boolean).map(String) : [],
            attributes: Array.isArray(e.attributes) ? e.attributes.filter(Boolean).map(String) : [],
            confidence: typeof e.confidence === 'number' ? Math.min(1, Math.max(0, e.confidence)) : 0.85,
          } as EntityNode;
        });

      const newEdges: EntityEdge[] = (Array.isArray(parsed.edges) ? parsed.edges : [])
        .filter((edge: any) => edge && labelToId.has(String(edge.source)) && labelToId.has(String(edge.target)))
        .map((edge: any) => ({
          id: uuid(),
          source: labelToId.get(String(edge.source))!,
          target: labelToId.get(String(edge.target))!,
          label: String(edge.label || 'related'),
          type: ['parent-child', 'contains', 'related'].includes(edge.type) ? edge.type : 'related',
          confidence: typeof edge.confidence === 'number' ? Math.min(1, Math.max(0, edge.confidence)) : 0.85,
        }));

      // Replace existing ontology
      updateEntities(newEntities, newEdges);
      addActivity({
        action: `Generated ontology: ${newEntities.length} entities, ${newEdges.length} relationships`,
        module: 'ontology',
        details: `From ${project.tables.length} profiled tables`,
      });
      setAiSuggestion(null);
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate ontology');
    } finally {
      setGenerateLoading(false);
    }
  }, [project, llm, updateEntities, addActivity]);

  const detectRelationshipsWithAI = useCallback(async (entityLabel: string, entityTables: string[], entityAttributes: string[]) => {
    if (!project || !llm.isConfigured || project.entities.length === 0) return;
    try {
      const existingEntities = project.entities.map(e =>
        `- ${e.label} (tables: ${e.tables.join(', ') || 'none'}; attributes: ${e.attributes.join(', ') || 'none'})`
      ).join('\n');
      const tablesCtx = project.tables.length > 0
        ? '\n\nAvailable source tables:\n' + project.tables.map(t =>
            `- ${t.name}: ${t.columns.map(c => `${c.name} (${c.datatype}${c.isKey ? ', primary key' : ''})`).join(', ')}`
          ).join('\n')
        : '';

      const result = await llm.generate(
        `You are a data modeling assistant. Identify logical business relationships between data entities.

New entity being added:
- Name: ${entityLabel}
- Source tables: ${entityTables.join(', ') || 'none'}
- Attributes: ${entityAttributes.join(', ') || 'none'}

Existing entities:
${existingEntities}${tablesCtx}

Task: For each existing entity that has a meaningful data relationship with the new entity, produce one record with these fields: target (the existing entity name), label (a short relationship verb such as "has", "belongs to", "contains"), type (one of: parent-child, contains, related), confidence (a number from 0 to 1).

Respond with only a JSON object in this shape:
{"items":[{"target":"Customer","label":"has","type":"parent-child","confidence":0.9}]}

If no meaningful relationships exist, respond with: {"items":[]}`,
        '',
      );

      // Parse JSON from response (accept either {items:[...]} or a raw array)
      let parsed: any = null;
      const objMatch = result.match(/\{[\s\S]*\}/);
      try {
        if (objMatch) parsed = JSON.parse(objMatch[0]);
      } catch { /* fall through */ }
      if (parsed && Array.isArray(parsed.items)) parsed = parsed.items;
      if (!Array.isArray(parsed)) {
        const arrMatch = result.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          try { parsed = JSON.parse(arrMatch[0]); } catch { parsed = null; }
        }
      }

      if (Array.isArray(parsed)) {
        const valid = parsed.filter((r: any) =>
          r && r.target && r.label && ['parent-child', 'contains', 'related'].includes(r.type) &&
          typeof r.confidence === 'number' &&
          project.entities.some(e => e.label === r.target)
        );
        setAiRelationships(valid);
        return;
      }
      setAiRelationships([]);
    } catch {
      setAiRelationships([]);
    }
  }, [project, llm]);

  const handleAddEntity = useCallback(async () => {
    if (!form.label.trim()) return;
    setAddingEntity(true);

    const tables = form.tables.split(',').map(s => s.trim()).filter(Boolean);
    const attributes = form.attributes.split(',').map(s => s.trim()).filter(Boolean);

    // Detect relationships with AI first
    if (llm.isConfigured && project && project.entities.length > 0) {
      await detectRelationshipsWithAI(form.label, tables, attributes);
    }

    const entityId = uuid();
    const entity: EntityNode = {
      id: entityId,
      label: form.label.trim(),
      tables,
      attributes,
      confidence: 0.9,
    };
    addEntity(entity);

    // Add AI-detected relationships
    // We need to get the latest aiRelationships state after detectRelationshipsWithAI
    // Since setState is async, we'll use a ref-like approach via closure
    // Actually the state will be set by the time we get here since we awaited
    const currentProject = useAppStore.getState().projects.find(p => p.id === useAppStore.getState().activeProjectId);

    setAddingEntity(false);
    setForm(EMPTY_FORM);
    setShowAddForm(false);

    addActivity({ action: `Added entity: ${form.label}`, module: 'ontology' });
  }, [form, addEntity, addActivity, llm, project, detectRelationshipsWithAI]);

  // Apply AI relationships after entity is added
  const handleApplyRelationships = useCallback(() => {
    if (!project) return;
    const newEntity = project.entities[project.entities.length - 1];
    if (!newEntity) return;

    aiRelationships.forEach(rel => {
      const targetEntity = project.entities.find(e => e.label === rel.target);
      if (targetEntity) {
        addEdge({
          id: uuid(),
          source: newEntity.id,
          target: targetEntity.id,
          label: rel.label,
          type: rel.type,
          confidence: rel.confidence,
        });
      }
    });
    addActivity({ action: `Added ${aiRelationships.length} AI-detected relationships`, module: 'ontology' });
    setAiRelationships([]);
  }, [project, aiRelationships, addEdge, addActivity]);

  const { nodes, edges, relationships } = useMemo(() => {
    if (!project) return { nodes: [], edges: [], relationships: [] };
    const count = Math.max(project.entities.length, 1);
    const angleStep = (2 * Math.PI) / count;
    const radius = 250;
    const cx = 400, cy = 320;

    const flowNodes: Node[] = project.entities.map((e, i) => ({
      id: e.id,
      type: 'entity',
      position: { x: cx + Math.cos(angleStep * i - Math.PI / 2) * radius, y: cy + Math.sin(angleStep * i - Math.PI / 2) * radius },
      data: { label: e.label, tables: e.tables, attributes: e.attributes, confidence: e.confidence },
    }));

    const flowEdges: Edge[] = project.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'smoothstep',
      animated: e.type === 'parent-child',
      style: {
        stroke: TYPE_COLORS[e.type] || 'hsl(200, 85%, 55%)',
        strokeWidth: e.type === 'parent-child' ? 2.5 : 2,
        strokeDasharray: TYPE_DASH[e.type] || '0',
      },
      labelStyle: {
        fill: 'hsl(210, 20%, 80%)',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: 'hsl(225, 25%, 12%)',
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: TYPE_COLORS[e.type] || 'hsl(200, 85%, 55%)', width: 16, height: 16 },
    }));

    const rels = project.edges.map((e) => {
      const srcEntity = project.entities.find(ent => ent.id === e.source);
      const tgtEntity = project.entities.find(ent => ent.id === e.target);
      return {
        id: e.id,
        sourceLabel: srcEntity?.label || e.source,
        targetLabel: tgtEntity?.label || e.target,
        label: e.label,
        type: e.type,
        confidence: e.confidence,
      };
    });

    return { nodes: flowNodes, edges: flowEdges, relationships: rels };
  }, [project]);

  if (!project) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
            <Share2 className="w-5 h-5 text-primary" /> Ontology
          </h2>
          <p className="text-sm text-muted-foreground">
            {project.entities.length} entities · {project.edges.length} relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAiRelationships([]); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-primary"
          >
            <Plus className="w-4 h-4" />
            Add Entity
          </button>
          {llm.isConfigured && (
            <>
              <button
                onClick={handleGenerateOntology}
                disabled={generateLoading || project.tables.length === 0}
                title={project.tables.length === 0 ? 'Profile data sources first' : 'Generate entities & relationships from profiled tables'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generateLoading ? 'Generating…' : 'Generate from Profile'}
              </button>
              <button
                onClick={handleAiSuggestOntology}
                disabled={suggestLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-agent text-agent-foreground text-sm font-medium hover:opacity-90 transition-opacity glow-agent"
              >
                {suggestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI Suggest
              </button>
            </>
          )}
        </div>
      </div>

      {generateError && (
        <div className="px-6 py-2 bg-destructive/10 border-b border-destructive/30 text-xs text-destructive flex items-center justify-between">
          <span>{generateError}</span>
          <button onClick={() => setGenerateError(null)} className="text-destructive/70 hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Entity Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="px-6 py-4 bg-card/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> New Entity
                </span>
                <button onClick={() => { setShowAddForm(false); setAiRelationships([]); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Entity Name *</label>
                  <input
                    value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="e.g. Customer, Order, Product"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Source Tables</label>
                  <input
                    value={form.tables}
                    onChange={e => setForm(f => ({ ...f, tables: e.target.value }))}
                    placeholder="Click suggestions below or type comma-separated"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {project.tables.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1.5 max-h-20 overflow-y-auto scrollbar-thin">
                      {project.tables.map(t => {
                        const selected = form.tables.split(',').map(s => s.trim()).filter(Boolean);
                        const isSelected = selected.includes(t.name);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selected.filter(s => s !== t.name)
                                : [...selected, t.name];
                              const nextTables = next.join(', ');
                              // Auto-suggest attributes from the picked table's columns when adding
                              let nextAttrs = form.attributes;
                              if (!isSelected) {
                                const existingAttrs = form.attributes.split(',').map(s => s.trim()).filter(Boolean);
                                const newAttrs = t.columns.map(c => c.name).filter(c => !existingAttrs.includes(c));
                                nextAttrs = [...existingAttrs, ...newAttrs].join(', ');
                              }
                              setForm(f => ({ ...f, tables: nextTables, attributes: nextAttrs }));
                            }}
                            className={cn(
                              "text-[10px] font-mono px-2 py-0.5 rounded border transition-all",
                              isSelected
                                ? "border-primary/60 bg-primary/15 text-primary"
                                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40"
                            )}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {project.tables.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/70 pt-1">No profiled tables yet — add data sources first to see suggestions.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Attributes (comma-separated)</label>
                  <input
                    value={form.attributes}
                    onChange={e => setForm(f => ({ ...f, attributes: e.target.value }))}
                    placeholder="e.g. customer_id, name, email"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddEntity}
                  disabled={!form.label.trim() || addingEntity}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    form.label.trim() && !addingEntity
                      ? "gradient-primary text-primary-foreground glow-primary hover:opacity-90"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {addingEntity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {addingEntity ? 'Adding & Detecting Relationships...' : 'Add Entity'}
                </button>
                {llm.isConfigured && project.entities.length > 0 && form.label.trim() && !addingEntity && (
                  <span className="text-[10px] text-agent flex items-center gap-1">
                    <Wand2 className="w-3 h-3" /> AI will auto-detect relationships
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI-Detected Relationships Confirmation */}
      <AnimatePresence>
        {aiRelationships.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-agent/20"
          >
            <div className="px-6 py-3 bg-agent/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-agent flex items-center gap-2">
                  <Wand2 className="w-3.5 h-3.5" /> AI Detected {aiRelationships.length} Relationship{aiRelationships.length > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApplyRelationships}
                    className="px-3 py-1 rounded-md gradient-agent text-agent-foreground text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    Apply All
                  </button>
                  <button
                    onClick={() => setAiRelationships([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {aiRelationships.map((rel, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-card/50 border border-border/50 rounded-lg px-3 py-2">
                    <span className="font-semibold text-foreground">{project.entities[project.entities.length - 1]?.label || '?'}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{rel.target}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded ml-1" style={{ color: TYPE_COLORS[rel.type], backgroundColor: `${TYPE_COLORS[rel.type]}15` }}>
                      {rel.label}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: TYPE_COLORS[rel.type], backgroundColor: `${TYPE_COLORS[rel.type]}10` }}>
                      {TYPE_LABELS[rel.type]}
                    </span>
                    <span className={cn("text-[9px] font-mono ml-auto", rel.confidence >= 0.9 ? "text-success" : "text-warning")}>
                      {Math.round(rel.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI status / error fallback (suggestions are auto-applied to the graph) */}
      {aiSuggestion && (
        <div className="px-6 py-3 bg-agent/5 border-b border-agent/20 max-h-48 overflow-y-auto scrollbar-thin">
          <div className="flex items-center gap-2 mb-2 text-xs text-agent font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> AI Ontology
            <button onClick={() => setAiSuggestion(null)} className="ml-auto text-muted-foreground hover:text-foreground text-[10px]">dismiss</button>
          </div>
          <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{aiSuggestion}</pre>
        </div>
      )}

      {project.entities.length === 0 && !aiSuggestion ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-10 h-10 text-agent/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-1">No entities defined yet</p>
            <p className="text-xs text-muted-foreground">
              Click "Add Entity" above{llm.isConfigured ? ' or use "AI Suggest"' : ''} to get started
            </p>
          </div>
        </motion.div>
      ) : project.entities.length > 0 ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Graph area */}
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onConnect={handleConnect}
              connectionMode={ConnectionMode.Loose}
              connectionLineStyle={{ stroke: 'hsl(200, 85%, 55%)', strokeWidth: 2 }}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background color="hsl(225, 16%, 14%)" gap={24} size={1} />
              <Controls />
            </ReactFlow>

            {/* Connection relationship dialog */}
            <AnimatePresence>
              {pendingConnection && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-card border border-border rounded-xl shadow-2xl p-4 w-80"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" /> New Relationship
                    </span>
                    <button onClick={() => setPendingConnection(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="font-semibold text-foreground">{project.entities.find(e => e.id === pendingConnection.sourceId)?.label}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{project.entities.find(e => e.id === pendingConnection.targetId)?.label}</span>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground uppercase">Label *</label>
                      <input
                        value={relForm.label}
                        onChange={e => setRelForm(f => ({ ...f, label: e.target.value }))}
                        placeholder="e.g. has_many, belongs_to, contains"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground uppercase">Type</label>
                      <div className="flex gap-2">
                        {(Object.keys(TYPE_LABELS) as Array<'parent-child' | 'related' | 'contains'>).map(t => (
                          <button
                            key={t}
                            onClick={() => setRelForm(f => ({ ...f, type: t }))}
                            className={cn(
                              "text-[10px] font-mono px-2.5 py-1.5 rounded-md border transition-all",
                              relForm.type === t
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            )}
                            style={relForm.type === t ? { color: TYPE_COLORS[t], borderColor: `${TYPE_COLORS[t]}50`, backgroundColor: `${TYPE_COLORS[t]}15` } : {}}
                          >
                            {TYPE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleConfirmRelationship}
                    disabled={!relForm.label.trim()}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      relForm.label.trim()
                        ? "gradient-primary text-primary-foreground glow-primary hover:opacity-90"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Link2 className="w-4 h-4" /> Add Relationship
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Legend overlay */}
            <div className="absolute bottom-14 left-4 bg-card/90 backdrop-blur border border-border rounded-lg p-3 space-y-1.5 z-10">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Relationship Types</span>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <svg width="28" height="8">
                    <line x1="0" y1="4" x2="28" y2="4" stroke={color} strokeWidth={2} strokeDasharray={TYPE_DASH[type]} />
                  </svg>
                  <span className="text-[10px] font-mono" style={{ color }}>{TYPE_LABELS[type]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relationships sidebar */}
          <div className="w-64 border-l border-border bg-card/30 overflow-y-auto scrollbar-thin shrink-0">
            <div className="p-3 border-b border-border">
              <span className="text-xs font-semibold text-foreground">Relationships</span>
              <span className="text-[10px] text-muted-foreground ml-2">{relationships.length}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {relationships.map((rel, i) => (
                <motion.div
                  key={rel.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-muted/30 border border-border/50 rounded-lg p-2.5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[11px] font-semibold text-foreground">{rel.sourceLabel}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-semibold text-foreground">{rel.targetLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: TYPE_COLORS[rel.type], backgroundColor: `${TYPE_COLORS[rel.type]}15` }}>
                      {rel.label}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: TYPE_COLORS[rel.type], backgroundColor: `${TYPE_COLORS[rel.type]}10` }}>
                      {TYPE_LABELS[rel.type]}
                    </span>
                    <span className={cn(
                      "text-[9px] font-mono ml-auto",
                      rel.confidence >= 0.95 ? "text-success" :
                      rel.confidence >= 0.9 ? "text-primary" : "text-warning"
                    )}>{Math.round(rel.confidence * 100)}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
