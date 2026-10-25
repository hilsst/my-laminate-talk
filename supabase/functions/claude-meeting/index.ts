// My Laminate Talk: Claude meeting partner.
// The page sends the conversation with the signed-in member's session token; this function checks
// that the member is on the allow list, then calls Claude with the API key kept as a Supabase secret.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY   required, your Claude API key
//   ALLOWED_EMAILS      required, comma-separated e-mails allowed to use it (yours)
//   CLAUDE_MODEL        optional, default claude-opus-5-5 (claude-haiku-5-5 is much cheaper)
//   ALLOWED_ORIGINS     optional, default https://hilsst.github.io
import Anthropic from "npm:@anthropic-ai/sdk@0.137.0";

const MODEL = Deno.env.get("CLAUDE_MODEL")?.trim() || "claude-opus-5-5";
// models that accept the server-side refusal fallback
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "https://hilsst.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const ALLOWED = (Deno.env.get("ALLOWED_EMAILS") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const MAX_MESSAGES = 40, MAX_CHARS = 60000;
// quick = meeting turns and word rescue, default = the 4/3/2 rewrite
const TIERS = { quick: { effort: "low", max_tokens: 4000 }, default: { effort: "medium", max_tokens: 8000 } } as const;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  const ok = ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function out(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

// who is calling: the Supabase session token is checked against the project's auth server
async function member(req: Request): Promise<{ email: string } | null> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const base = Deno.env.get("SUPABASE_URL");
  if (!token || !base) return null;
  const r = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.email ? { email: String(u.email).toLowerCase() } : null;
}

type Msg = { role: "user" | "assistant"; content: string };
function cleanMessages(x: unknown): Msg[] | null {
  if (!Array.isArray(x) || !x.length || x.length > MAX_MESSAGES) return null;
  const ms: Msg[] = [];
  for (const m of x) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) return null;
    ms.push({ role: m.role, content: m.content });
  }
  if (ms[0].role !== "user" || ms[ms.length - 1].role !== "user") return null;
  return ms;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return out(req, 405, { error: "method" });

  const who = await member(req).catch(() => null);
  if (!who) return out(req, 401, { error: "session_expired" });
  if (!ALLOWED.includes(who.email)) return out(req, 403, { error: "forbidden" });
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return out(req, 500, { error: "not_configured" });

  const body = await req.json().catch(() => null);
  const messages = cleanMessages(body?.messages);
  if (!messages) return out(req, 400, { error: "bad_request" });
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) return out(req, 413, { error: "too_large" });
  const tier = TIERS[body?.tier === "quick" ? "quick" : "default"];

  const client = new Anthropic({ apiKey: key });
  try {
    const params = {
      model: MODEL,
      max_tokens: tier.max_tokens,
      output_config: { effort: tier.effort },
      messages,
      ...(FALLBACK_MODELS.has(MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    };
    // deno-lint-ignore no-explicit-any
    const res = await client.beta.messages.create(params as any);
    if (res.stop_reason === "refusal") return out(req, 422, { error: "refusal" });
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) return out(req, 502, { error: "empty_completion" });
    return out(req, 200, { text, model: res.model, usage: res.usage });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return out(req, 429, { error: "rate_limited" });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return out(req, 500, { error: "bad_api_key" });
    if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) return out(req, 502, { error: "upstream" });
    if (e instanceof Anthropic.APIConnectionError) return out(req, 502, { error: "upstream" });
    console.error(e);
    return out(req, 500, { error: "server", message: String((e as Error)?.message || e).slice(0, 300) });
  }
});
