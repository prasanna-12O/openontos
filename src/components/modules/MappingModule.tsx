import { useState, useCallback } from 'react';
import { ArrowRightLeft, Check, ChevronRight, Sparkles, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useLLM } from '@/hooks/useLLM';
import { v4 as uuid } from 'uuid';
import type { MappingItem } from '@/types/project';

interface SuggestedMapping {
  sourceTable: string;
  sourceColumn: string;
  targetEntity: string;
  targetAttribute: string;
  transformLogic: string;
  confidence: number;
}

export default function MappingModule() {
  const { getActiveProject, approveMapping, addMapping, addActivity } = useAppStore();
  const project = getActiveProject();
  const llm = useLLM('mapping');
  const [suggestions, setSuggestions] = useState<SuggestedMapping[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const handleAiSuggestMappings = useCallback(async () => {
    if (!project || !llm.isConfigured) return;
    setSuggestError(null);

    if (project.tables.length === 0) {
      setSuggestError('No profiled source tables. Connect a data source and run profiling first.');
      return;
    }
    if (project.entities.length === 0) {
      setSuggestError('No target ontology entities. Generate an ontology in the Ontology module first.');
      return;
    }

    setSuggestLoading(true);
    try {
      const tablesCtx = project.tables.map(t =>
        `Table "${t.name}" (${t.rowCount} rows): ${t.columns.map(c =>
          `${c.name} (${c.datatype}${c.isKey ? ', PK' : ''}${c.nullPercent > 0 ? `, ${c.nullPercent}% null` : ''})`
        ).join(', ')}`
      ).join('\n');

      const entitiesCtx = project.entities.map(e =>
        `Entity "${e.label}" (from tables: ${e.tables.join(', ') || 'none'}): attributes: ${e.attributes.join(', ')}`
      ).join('\n');

      const existingMappings = project.mappings.map(m =>
        `${m.sourceTable}.${m.sourceColumn} → ${m.targetEntity}.${m.targetAttribute}`
      ).join('\n') || 'none';

      const prompt = `You are a senior data engineer. Based on the profiled source tables and target ontology entities below, suggest source-to-target column mappings.

PROFILED SOURCE TABLES:
${tablesCtx}

TARGET ONTOLOGY ENTITIES:
${entitiesCtx}

EXISTING MAPPINGS (do not duplicate):
${existingMappings}

Industry: ${project.industryType || 'general'}
Subject area: ${project.subjectArea || 'general'}

Rules:
- Only suggest mappings between source columns and entity attributes that actually exist in the lists above.
- Suggest a sensible SQL transformLogic (e.g. CAST, TRIM, UPPER, LOWER, COALESCE, or just the column name if no transform is needed).
- confidence is 0-1 reflecting semantic match strength.
- Suggest 5-20 mappings, prioritising key columns and clearly named business attributes.
- Skip mappings that are already in the EXISTING MAPPINGS list.

Respond with ONLY a JSON object in this exact shape (no markdown, no commentary):
{
  "mappings": [
    {
      "sourceTable": "raw_customers",
      "sourceColumn": "customer_id",
      "targetEntity": "Customer",
      "targetAttribute": "customer_key",
      "transformLogic": "CAST(customer_id AS BIGINT)",
      "confidence": 0.98
    }
  ]
}`;

      const result = await llm.generate(prompt, '');

      // Parse JSON
      let parsed: any = null;
      const fenced = result.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = fenced ? fenced[1] : result;
      const objMatch = candidate.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { parsed = JSON.parse(objMatch[0]); } catch { /* noop */ }
      }
      if (!parsed || !Array.isArray(parsed.mappings)) {
        throw new Error('AI returned an unexpected format. Please try again.');
      }

      // Validate against actual schema
      const tableNames = new Set(project.tables.map(t => t.name));
      const entityLabels = new Set(project.entities.map(e => e.label));

      const valid: SuggestedMapping[] = parsed.mappings
        .filter((m: any) =>
          m && typeof m.sourceTable === 'string' && typeof m.sourceColumn === 'string' &&
          typeof m.targetEntity === 'string' && typeof m.targetAttribute === 'string' &&
          tableNames.has(m.sourceTable) && entityLabels.has(m.targetEntity)
        )
        .map((m: any) => ({
          sourceTable: String(m.sourceTable),
          sourceColumn: String(m.sourceColumn),
          targetEntity: String(m.targetEntity),
          targetAttribute: String(m.targetAttribute),
          transformLogic: String(m.transformLogic || m.sourceColumn),
          confidence: typeof m.confidence === 'number' ? Math.min(1, Math.max(0, m.confidence)) : 0.85,
        }));

      if (valid.length === 0) {
        setSuggestError('AI could not find any new valid mappings between your sources and ontology.');
        setSuggestions([]);
        return;
      }
      setSuggestions(valid);
    } catch (err: any) {
      setSuggestError(err?.message || 'Failed to generate suggestions');
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }, [project, llm]);

  const acceptSuggestion = useCallback((s: SuggestedMapping, autoApprove = false) => {
    const item: MappingItem = {
      id: uuid(),
      sourceTable: s.sourceTable,
      sourceColumn: s.sourceColumn,
      targetEntity: s.targetEntity,
      targetAttribute: s.targetAttribute,
      transformLogic: s.transformLogic,
      confidence: s.confidence,
      approved: autoApprove,
    };
    addMapping(item);
    addActivity({
      action: `${autoApprove ? 'Approved' : 'Added'} mapping: ${s.sourceTable}.${s.sourceColumn} → ${s.targetEntity}.${s.targetAttribute}`,
      module: 'mapping',
    });
    setSuggestions(prev => prev.filter(x =>
      !(x.sourceTable === s.sourceTable && x.sourceColumn === s.sourceColumn &&
        x.targetEntity === s.targetEntity && x.targetAttribute === s.targetAttribute)
    ));
  }, [addMapping, addActivity]);

  const acceptAllSuggestions = useCallback(() => {
    suggestions.forEach(s => acceptSuggestion(s, false));
  }, [suggestions, acceptSuggestion]);

  const dismissSuggestion = useCallback((s: SuggestedMapping) => {
    setSuggestions(prev => prev.filter(x =>
      !(x.sourceTable === s.sourceTable && x.sourceColumn === s.sourceColumn &&
        x.targetEntity === s.targetEntity && x.targetAttribute === s.targetAttribute)
    ));
  }, []);

  if (!project) return null;

  const approved = project.mappings.filter(m => m.approved).length;
  const pending = project.mappings.filter(m => !m.approved).length;

  const grouped = project.mappings.reduce<Record<string, typeof project.mappings>>((acc, m) => {
    (acc[m.targetEntity] = acc[m.targetEntity] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Mapping
            </h2>
            <p className="text-sm text-muted-foreground">Source-to-target attribute mapping with AI suggestions</p>
          </div>
          <div className="flex items-center gap-3">
            {llm.isConfigured && (
              <button
                onClick={handleAiSuggestMappings}
                disabled={suggestLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg gradient-agent text-agent-foreground text-xs font-medium hover:opacity-90 transition-opacity glow-agent disabled:opacity-50"
              >
                {suggestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Suggest
              </button>
            )}
            <div className="flex gap-3 text-xs">
              <div className="px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg text-success">
                <span className="font-bold">{approved}</span> approved
              </div>
              <div className="px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg text-warning">
                <span className="font-bold">{pending}</span> pending
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {suggestError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-warning/5 border border-warning/30 rounded-xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-warning/90">{suggestError}</div>
            <button onClick={() => setSuggestError(null)} className="text-muted-foreground hover:text-foreground text-[10px]">dismiss</button>
          </motion.div>
        )}

        {/* AI Suggestion Cards */}
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-agent/5 border border-agent/30 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-agent/20 bg-agent/10 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-agent" />
              <span className="text-xs font-semibold text-agent">
                {suggestions.length} AI mapping suggestion{suggestions.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={acceptAllSuggestions}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-agent text-agent-foreground text-[10px] font-medium hover:opacity-90 transition-opacity"
              >
                <Wand2 className="w-3 h-3" /> Accept all
              </button>
              <button
                onClick={() => setSuggestions([])}
                className="text-muted-foreground hover:text-foreground text-[10px]"
              >
                dismiss
              </button>
            </div>
            <div className="divide-y divide-agent/10">
              {suggestions.map((s, i) => (
                <motion.div
                  key={`${s.sourceTable}-${s.sourceColumn}-${s.targetEntity}-${s.targetAttribute}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-agent/5 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground mb-0.5">{s.sourceTable}</div>
                    <div className="text-sm font-mono font-medium truncate">{s.sourceColumn}</div>
                  </div>
                  <div className="flex flex-col items-center shrink-0 px-2">
                    <ChevronRight className="w-4 h-4 text-agent" />
                    <span className="text-[9px] font-mono text-muted-foreground max-w-[180px] truncate text-center">{s.transformLogic}</span>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-xs text-muted-foreground mb-0.5">{s.targetEntity}</div>
                    <div className="text-sm font-mono font-medium truncate">{s.targetAttribute}</div>
                  </div>
                  <div className={cn(
                    "text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0",
                    s.confidence >= 0.95 ? "bg-success/15 text-success" :
                    s.confidence >= 0.9 ? "bg-primary/15 text-primary" :
                    "bg-warning/15 text-warning"
                  )}>
                    {Math.round(s.confidence * 100)}%
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => acceptSuggestion(s, true)}
                      title="Accept & approve"
                      className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center hover:bg-success/20 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5 text-success" />
                    </button>
                    <button
                      onClick={() => dismissSuggestion(s)}
                      title="Dismiss"
                      className="w-7 h-7 rounded-lg bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {project.mappings.length === 0 && suggestions.length === 0 ? (
          <div className="text-center py-16">
            <ArrowRightLeft className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No mappings defined</p>
            <p className="text-xs text-muted-foreground mt-1">
              {llm.isConfigured ? 'Click "AI Suggest" above to generate mappings from your profiled data and ontology' : 'Use AI Agent → "Create source-to-target mapping"'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([entity, mappings]) => (
              <div key={entity} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full gradient-primary" />
                  <span className="font-semibold text-sm">{entity}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{mappings.length} attributes</span>
                </div>
                <div className="divide-y divide-border/30">
                  {mappings.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground mb-0.5">{m.sourceTable}</div>
                        <div className="text-sm font-mono font-medium truncate">{m.sourceColumn}</div>
                      </div>
                      <div className="flex flex-col items-center shrink-0 px-2">
                        <ChevronRight className="w-4 h-4 text-primary" />
                        <span className="text-[9px] font-mono text-muted-foreground max-w-[180px] truncate text-center">{m.transformLogic}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="text-xs text-muted-foreground mb-0.5">{m.targetEntity}</div>
                        <div className="text-sm font-mono font-medium truncate">{m.targetAttribute}</div>
                      </div>
                      <div className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0",
                        m.confidence >= 0.95 ? "bg-success/15 text-success" :
                        m.confidence >= 0.9 ? "bg-primary/15 text-primary" :
                        "bg-warning/15 text-warning"
                      )}>
                        {Math.round(m.confidence * 100)}%
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {m.approved ? (
                          <span className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-success" />
                          </span>
                        ) : (
                          <button
                            onClick={() => approveMapping(m.id)}
                            className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center hover:bg-success/20 transition-colors opacity-60 group-hover:opacity-100"
                          >
                            <Check className="w-3.5 h-3.5 text-success" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
