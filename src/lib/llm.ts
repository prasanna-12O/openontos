import type { LLMConfig, ModuleId } from '@/types/project';

const MODULE_SYSTEM_PROMPTS: Record<ModuleId, string> = {
  datasources: 'You are a Data Sources Agent for a data engineering platform called OpenOntos. Help users connect and configure data sources like databases, cloud storage, and APIs.',
  profile: 'You are a Schema Profiling Agent for OpenOntos. Help users understand their data schemas, column statistics, data quality issues, anomalies, and primary/foreign key relationships.',
  ontology: 'You are an Ontology Design Agent for OpenOntos. Help users identify business entities, define relationships, and build conceptual data models from their profiled schemas.',
  mapping: 'You are a Mapping Agent for OpenOntos. Help users create source-to-target mappings, define transformation logic, and validate mapping coverage between raw tables and ontology entities.',
  etl: 'You are an ETL Code Generation Agent for OpenOntos. Help users generate Bronze/Silver/Gold layer ETL code for platforms like Snowflake, BigQuery, Redshift, Databricks, and Fabric.',
  pipelines: 'You are a Pipelines Agent for OpenOntos. Help users orchestrate, schedule, and run ETL pipelines across bronze/silver/gold layers on target data platforms.',
  deploy: 'You are a Deployment Agent for OpenOntos. Help users prepare deployment packages, check readiness, select target platforms, and export deployment bundles.',
  monitor: 'You are a Monitoring Agent for OpenOntos. Help users track pipeline health, identify validation issues, review data quality metrics, and resolve warnings.',
  settings: 'You are a Settings Agent for OpenOntos. Help users configure their LLM models, API connections, and application preferences.',
};

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export interface ProjectContext {
  industryType?: string;
  subjectArea?: string;
  projectName?: string;
}

/** Special sentinel URL — routes through the Lovable AI Gateway edge function. */
export const LOVABLE_GATEWAY_URL = 'lovable://gateway';

export const BUILTIN_LOVABLE_LLM: LLMConfig = {
  id: 'builtin-lovable-ai',
  name: 'Lovable AI (built-in)',
  apiUrl: LOVABLE_GATEWAY_URL,
  apiToken: 'managed',
  modelName: 'google/gemini-2.5-flash',
  isDefault: true,
};

function isLovableGateway(config: LLMConfig): boolean {
  return config.apiUrl === LOVABLE_GATEWAY_URL;
}

function isAzureOpenAI(url: string): boolean {
  return /\.(openai\.azure\.com|cognitiveservices\.azure\.com)/i.test(url);
}

/**
 * All LLM calls go through the `llm-proxy` edge function to bypass browser CORS
 * restrictions. For the built-in Lovable AI gateway, the function uses its own
 * LOVABLE_API_KEY. For custom configs, we forward the user's endpoint + token.
 */
function resolveProxyRequest(config: LLMConfig): {
  url: string;
  headers: Record<string, string>;
  upstream?: { upstreamUrl: string; upstreamToken: string; upstreamAuthHeader?: string };
} {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const proxyUrl = `${base}/functions/v1/llm-proxy`;
  const headers = {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}`, apikey: key } : {}),
  };

  if (isLovableGateway(config)) {
    return { url: proxyUrl, headers };
  }

  return {
    url: proxyUrl,
    headers,
    upstream: {
      upstreamUrl: config.apiUrl,
      upstreamToken: config.apiToken,
      // Azure OpenAI uses an "api-key" header instead of "Authorization: Bearer".
      upstreamAuthHeader: isAzureOpenAI(config.apiUrl) ? 'api-key' : 'Authorization',
    },
  };
}

function buildSystemPrompt(module: ModuleId, projectContext?: ProjectContext): string {
  let prompt = MODULE_SYSTEM_PROMPTS[module];
  if (projectContext && (projectContext.industryType || projectContext.subjectArea)) {
    prompt += `\n\nProject Context:`;
    if (projectContext.projectName) prompt += `\n- Project: ${projectContext.projectName}`;
    if (projectContext.industryType) prompt += `\n- Industry: ${projectContext.industryType}`;
    if (projectContext.subjectArea) prompt += `\n- Subject Area: ${projectContext.subjectArea}`;
    prompt += `\nUse this context to provide industry-specific terminology, best practices, and domain-relevant suggestions.`;
  }
  return prompt;
}

export async function callLLM(
  config: LLMConfig,
  module: ModuleId,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  projectContext?: ProjectContext,
) {
  const systemPrompt = buildSystemPrompt(module, projectContext);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const { url, headers, upstream } = resolveProxyRequest(config);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.modelName,
        messages,
        stream: true,
        ...(upstream || {}),
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errMsg = `API error ${response.status}: ${errorText || response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.error) errMsg = parsed.error;
      } catch { /* ignore */ }
      callbacks.onError(errMsg);
      return;
    }

    if (!response.body) {
      callbacks.onError('No response body received');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) callbacks.onToken(content);
        } catch {
          // partial JSON, put back
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    // Flush remaining
    if (buffer.trim()) {
      for (let raw of buffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) callbacks.onToken(content);
        } catch { /* ignore */ }
      }
    }

    callbacks.onDone();
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    callbacks.onError(err.message || 'Unknown error');
  }
}

/** Non-streaming fallback. */
export async function callLLMNonStreaming(
  config: LLMConfig,
  module: ModuleId,
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  projectContext?: ProjectContext,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(module, projectContext);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const { url, headers, upstream } = resolveProxyRequest(config);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.modelName,
      messages,
      stream: false,
      ...(upstream || {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errMsg = `API error ${response.status}: ${errorText || response.statusText}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed?.error) errMsg = parsed.error;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from model.';
}
