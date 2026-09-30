// Public MCP server for Meta's Muse agent (and any other MCP client).
//
// Streamable HTTP, stateless: every POST gets a fresh McpServer + transport, so
// nothing is shared between callers and no session store is needed. v1 exposes
// only public, no-user-data tools (see api/_lib/mcpTools.ts), which is why the
// endpoint needs no auth. Anything touching a user's dogs or recipes must NOT
// be added here without OAuth first.
//
// Abuse / cost controls:
//   * body capped at MAX_BODY_BYTES before JSON parsing;
//   * per-IP limit: an in-memory window per instance (always on) plus the
//     shared Supabase limiter used by the other public endpoints (fails open);
//   * zod-validated, length-bounded inputs; no LLM or paid API is ever called;
//   * logs carry the method, status and timing only, never tool arguments.
//
// Runs on the Node.js runtime (not Edge): the SDK's JSON-schema validator
// (ajv) compiles validators with `new Function`, which Edge disallows.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { checkIpRateLimit, tooManyRequestsResponse } from './_lib/rateLimit';
import {
  ACTIVITY_LEVELS,
  LIFE_STAGES,
  LIMITS,
  TREAT_CATEGORIES,
  checkFoodSafety,
  dailyCalorieEstimate,
  treatIdea,
} from './_lib/mcpTools';

const MAX_BODY_BYTES = 16 * 1024;
const LOCAL_WINDOW_MS = 60_000;
const LOCAL_LIMIT = 40;
const SHARED_LIMIT = 60;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function createCheffoMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'cheffo-doggo', version: '1.0.0', title: 'Cheffo Doggo' },
    {
      instructions:
        'Cheffo Doggo answers homemade dog food questions from a vetted reference list. ' +
        'Results are educational, not veterinary advice. Pass the veterinarian line through to the user unchanged.',
    }
  );

  server.registerTool(
    'check_food_safety',
    {
      title: 'Check if a food is safe for dogs',
      description:
        'Look up whether a human food is toxic, risky or generally dog-safe, using Cheffo Doggo\'s toxic-food and ingredient-safety lists. ' +
        'Returns "unknown" rather than guessing when a food is not in the list.',
      inputSchema: {
        food: z.string().trim().min(1).max(LIMITS.foodMaxChars).describe('The food to check, e.g. "grapes" or "plain pumpkin".'),
      },
      annotations: READ_ONLY,
    },
    async ({ food }) => ({ content: [{ type: 'text', text: checkFoodSafety(food).text }] })
  );

  server.registerTool(
    'daily_calorie_estimate',
    {
      title: 'Estimate a dog\'s daily calories',
      description:
        'Estimate daily calories (kcal/day) from weight, life stage and activity using the standard RER/DER formula Cheffo Doggo\'s calculator uses. ' +
        'A starting estimate only.',
      inputSchema: {
        weight: z.number().positive().max(1000).describe('Body weight (or target weight) of the dog.'),
        unit: z.enum(['lb', 'kg']).default('lb').describe('Unit for weight.'),
        life_stage: z.enum(LIFE_STAGES).describe('puppy, adult or senior.'),
        activity_level: z.enum(ACTIVITY_LEVELS).optional().describe('Adult dogs only: low, moderate (default), active or very_active.'),
      },
      annotations: READ_ONLY,
    },
    async ({ weight, unit, life_stage, activity_level }) => {
      try {
        const result = dailyCalorieEstimate({ weight, unit, lifeStage: life_stage, activityLevel: activity_level });
        return { content: [{ type: 'text', text: result.text }] };
      } catch (error) {
        if (error instanceof RangeError) return { isError: true, content: [{ type: 'text', text: error.message }] };
        throw error;
      }
    }
  );

  server.registerTool(
    'treat_idea',
    {
      title: 'Suggest a homemade dog treat',
      description:
        'Suggest a homemade treat from Cheffo Doggo\'s vetted treat catalog, optionally by category and skipping listed ingredients. ' +
        'Returns the name and full ingredient list; exact amounts are portioned per dog on cheffodoggo.com.',
      inputSchema: {
        category: z.enum(TREAT_CATEGORIES).optional().describe('training, frozen, birthday or everyday.'),
        avoid: z.array(z.string().trim().min(1).max(LIMITS.avoidMaxChars)).max(LIMITS.avoidMaxItems).optional()
          .describe('Ingredients to leave out, e.g. ["peanut butter", "yogurt"].'),
        pick: z.number().int().min(0).max(LIMITS.pickMax).optional().describe('Change this number to get a different idea.'),
      },
      annotations: READ_ONLY,
    },
    async ({ category, avoid, pick }) => ({ content: [{ type: 'text', text: treatIdea({ category, avoid, pick }).text }] })
  );

  return server;
}

// ── Rate limiting ────────────────────────────────────────────────────────────

const localHits = new Map<string, number[]>();

function clientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Per-instance sliding window. Keys are only kept in memory for the window and
// never logged; the shared limiter below stores a salted hash, not the IP.
export function allowLocal(key: string, now = Date.now()): boolean {
  const recent = (localHits.get(key) ?? []).filter(time => now - time < LOCAL_WINDOW_MS);
  if (recent.length >= LOCAL_LIMIT) {
    localHits.set(key, recent);
    return false;
  }
  recent.push(now);
  localHits.set(key, recent);
  if (localHits.size > 5000) {
    for (const [k, times] of localHits) if (!times.some(time => now - time < LOCAL_WINDOW_MS)) localHits.delete(k);
  }
  return true;
}

function jsonRpcError(status: number, message: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

// ── HTTP handlers (Vercel Node.js runtime, Web Request/Response signature) ───

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (!allowLocal(clientKey(req))) return jsonRpcError(429, 'Too many requests. Please slow down.', { 'Retry-After': '60' });
  const shared = await checkIpRateLimit(req, 'mcp', { limit: SHARED_LIMIT });
  if (!shared.allowed) return tooManyRequestsResponse(shared);

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return jsonRpcError(413, 'Request body too large.');
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return jsonRpcError(413, 'Request body too large.');

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    return jsonRpcError(400, 'Parse error: body must be JSON.');
  }

  const server = createCheffoMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(req, { parsedBody });
    const method = Array.isArray(parsedBody) ? 'batch' : String((parsedBody as { method?: unknown })?.method ?? 'unknown').slice(0, 40);
    console.log(JSON.stringify({ level: 'info', msg: 'mcp request', method, status: response.status, ms: Date.now() - startedAt }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'mcp request failed', error: error instanceof Error ? error.name : 'unknown' }));
    return jsonRpcError(500, 'Internal server error.');
  } finally {
    // JSON response mode has fully produced the body by now.
    void transport.close();
    void server.close();
  }
}

// Stateless server: no SSE stream to open and no session to delete.
export function GET(): Response {
  return jsonRpcError(405, 'Method not allowed. POST JSON-RPC messages to this endpoint.', { Allow: 'POST' });
}

export function DELETE(): Response {
  return jsonRpcError(405, 'Method not allowed. This server is stateless.', { Allow: 'POST' });
}
