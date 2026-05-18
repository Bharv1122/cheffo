// Server-side proxy for the LLM provider.
//
// The client used to call the provider directly with `VITE_LLM_API_KEY`, but
// Vite inlines VITE_-prefixed vars into the bundle, leaking the key to every
// visitor (CHE-5). The client now POSTs its OpenAI-compatible chat-completions
// body to /api/llm; this function attaches the bearer key server-side and
// streams the upstream response straight back — a pure passthrough, so the one
// endpoint serves streaming chat, recipe extraction, and image generation.

export const config = { runtime: 'edge' };

// The Edge runtime exposes process.env, but the app tsconfig's `vite/client`
// types don't declare it — declare the minimal shape locally.
declare const process: { env: Record<string, string | undefined> };

// Generous cap — a chat body is a system prompt plus up to 16 trimmed turns.
// Guards this open same-origin proxy against oversized requests to a paid API.
const MAX_BODY_CHARS = 256 * 1024;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed');

  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  if (!apiKey || !baseUrl) return jsonError(500, 'LLM proxy is not configured');

  const body = await req.text();
  if (body.length > MAX_BODY_CHARS) return jsonError(413, 'Request body too large');

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return jsonError(502, 'Upstream LLM request failed');
  }

  // Stream the upstream response through unbuffered — keeps SSE chat working.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
