import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { callLLM, callLLMNonStreaming, BUILTIN_LOVABLE_LLM } from '@/lib/llm';
import type { ModuleId } from '@/types/project';
import type { ProjectContext } from '@/lib/llm';

export function useLLM(module: ModuleId) {
  const { llmConfigs, getActiveProject } = useAppStore();
  // Prefer user-configured default; fall back to built-in Lovable AI gateway.
  const defaultLLM = llmConfigs.find(c => c.isDefault) || llmConfigs[0] || BUILTIN_LOVABLE_LLM;
  const [isLoading, setIsLoading] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Always configured — Lovable AI is available out of the box.
  const isConfigured = true;

  const getProjectContext = useCallback((): ProjectContext | undefined => {
    const project = getActiveProject();
    if (!project) return undefined;
    return {
      projectName: project.name,
      industryType: project.industryType,
      subjectArea: project.subjectArea,
    };
  }, [getActiveProject]);

  const generate = useCallback(async (prompt: string, context?: string): Promise<string> => {
    if (!defaultLLM) throw new Error('No LLM configured');
    setIsLoading(true);
    try {
      const history = context
        ? [{ role: 'user' as const, content: context }, { role: 'assistant' as const, content: 'Understood. I have the context.' }]
        : [];
      const result = await callLLMNonStreaming(defaultLLM, module, prompt, history, getProjectContext());
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [defaultLLM, module, getProjectContext]);

  const generateStreaming = useCallback(async (
    prompt: string,
    onToken: (content: string) => void,
    context?: string,
  ): Promise<string> => {
    if (!defaultLLM) throw new Error('No LLM configured');
    setIsLoading(true);
    setStreamedContent('');
    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = '';

    const history = context
      ? [{ role: 'user' as const, content: context }, { role: 'assistant' as const, content: 'Understood. I have the context.' }]
      : [];

    return new Promise((resolve, reject) => {
      callLLM(defaultLLM, module, prompt, history, {
        onToken: (token) => {
          accumulated += token;
          setStreamedContent(accumulated);
          onToken(accumulated);
        },
        onDone: () => {
          setIsLoading(false);
          abortRef.current = null;
          resolve(accumulated);
        },
        onError: (error) => {
          setIsLoading(false);
          abortRef.current = null;
          reject(new Error(error));
        },
      }, controller.signal, getProjectContext());
    });
  }, [defaultLLM, module, getProjectContext]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  return {
    isConfigured,
    isLoading,
    streamedContent,
    modelName: defaultLLM?.name || 'Not configured',
    generate,
    generateStreaming,
    cancel,
  };
}
