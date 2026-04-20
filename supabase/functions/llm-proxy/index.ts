// Universal LLM proxy. Streams chat completions to the browser.
// - Default: routes to the Lovable AI Gateway using LOVABLE_API_KEY (auto-provisioned).
// - Custom: if the client provides upstreamUrl + upstreamToken, proxies to that
//   endpoint instead (used to bypass CORS for OpenAI-compatible providers
//   like Azure OpenAI, OpenAI, Anthropic-compatible gateways, etc.).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAzureEndpointHint(url: string): string | null {
  try {
    const parsed = new URL(url);
    const isAzureHost = /\.(openai\.azure\.com|cognitiveservices\.azure\.com)$/i.test(parsed.hostname);
    if (!isAzureHost) return null;

    const normalizedPath = parsed.pathname.replace(/\/+$/, "");
    const hasDeploymentPath = /\/openai\/deployments\/[^/]+/i.test(normalizedPath);
    const hasCompletionPath = /\/(chat\/completions|responses)$/i.test(normalizedPath);
    const hasApiVersion = parsed.searchParams.has("api-version");

    if (hasDeploymentPath && hasCompletionPath && hasApiVersion) return null;

    return "Azure OpenAI requires the full chat completions endpoint, including deployment name and api-version, for example: https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-02-15-preview";
  } catch {
    return null;
  }
}

async function readUpstreamBody(upstream: Response) {
  const contentType = upstream.headers.get("content-type") || "";
  const text = await upstream.text().catch(() => "");

  if (!text) {
    return { text: "", json: null as any, contentType };
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    return { text, json: null as any, contentType };
  }

  try {
    return { text, json: JSON.parse(text), contentType };
  } catch {
    return { text, json: null as any, contentType };
  }
}

function extractUpstreamError(json: any, fallbackText: string, statusText: string) {
  const candidate = json?.error?.message || json?.error || json?.message || fallbackText || statusText;
  return typeof candidate === "string" ? candidate : JSON.stringify(candidate);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(
        JSON.stringify({ error: "Request body is empty. Expected JSON with `messages`." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { messages, model, stream, upstreamUrl, upstreamToken, upstreamAuthHeader } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "`messages` must be a non-empty array." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const wantsStream = stream !== false;
    const useCustom = typeof upstreamUrl === "string" && upstreamUrl.length > 0;

    let targetUrl: string;
    let authHeaders: Record<string, string> = {};

    if (useCustom) {
      targetUrl = upstreamUrl;
      const azureEndpointHint = getAzureEndpointHint(targetUrl);
      if (azureEndpointHint) {
        return jsonResponse({ error: azureEndpointHint }, 400);
      }
      if (upstreamToken) {
        // Most providers use "Authorization: Bearer <token>".
        // Azure OpenAI uses "api-key: <token>" — caller can override the header name.
        const headerName = upstreamAuthHeader || "Authorization";
        const headerValue = headerName.toLowerCase() === "authorization"
          ? `Bearer ${upstreamToken}`
          : upstreamToken;
        authHeaders[headerName] = headerValue;
      }
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUrl = LOVABLE_GATEWAY_URL;
      authHeaders["Authorization"] = `Bearer ${LOVABLE_API_KEY}`;
    }

    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || (useCustom ? undefined : "google/gemini-2.5-flash"),
        messages,
        stream: wantsStream,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      }
      if (upstream.status === 402) {
        return jsonResponse({
          error:
            "AI credits exhausted. Add funds in Settings → Workspace → Usage to continue.",
        }, 402);
      }
      const { text, json } = await readUpstreamBody(upstream);
      const errText = extractUpstreamError(json, text, upstream.statusText);
      console.error("LLM upstream error:", targetUrl, upstream.status, errText);
      return jsonResponse(
        { error: `Upstream error ${upstream.status}: ${errText || upstream.statusText}` },
        502,
      );
    }

    if (wantsStream) {
      return new Response(upstream.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const { text, json, contentType } = await readUpstreamBody(upstream);

    if (!text) {
      return jsonResponse({ error: "Upstream returned an empty response body." }, 502);
    }

    if (!json) {
      const snippet = text.slice(0, 500);
      const contentTypeLabel = contentType ? ` (${contentType})` : "";
      return jsonResponse(
        { error: `Upstream returned a non-JSON response${contentTypeLabel}: ${snippet}` },
        502,
      );
    }

    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("llm-proxy error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
