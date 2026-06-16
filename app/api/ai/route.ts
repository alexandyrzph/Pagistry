import { requireApiUser } from "@/lib/auth/auth";
import { withRole } from "@/lib/api/api-handler";
import { json, badRequest, error } from "@/lib/api/api-response";
import {
  sectionSystemPrompt,
  pageSystemPrompt,
  REWRITE_SYSTEM,
  REWRITE_INSTRUCTIONS,
  DESIGN_STYLE_KEYS,
  extractJsonArray,
  sanitizeGeneratedBlocks,
  MOCK_BLOCKS,
  MOCK_PAGE,
} from "@/lib/ai";

export const dynamic = "force-dynamic";

// Generation uses a strong model (design taste matters most); the cheap
// rewrite/copy-edit path stays on a small, fast model.
const GEN_MODEL = {
  anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
  openai: process.env.OPENAI_MODEL || "gpt-4o",
};
const REWRITE_MODEL = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

function available() {
  const list: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) list.push("anthropic");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  if (process.env.AI_MOCK === "1") list.push("mock");
  return list;
}

// GET /api/ai — which providers are configured
export async function GET() {
  const _auth = await requireApiUser();
  if ("response" in _auth) return _auth.response;
  const providers = available();
  return json({ providers, default: providers[0] ?? null });
}

async function callAnthropic(model: string, system: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data?.content?.[0]?.text ?? "";
}

async function callOpenAI(model: string, system: string, prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callModel(
  provider: string,
  models: { anthropic: string; openai: string },
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  return provider === "openai"
    ? callOpenAI(models.openai, system, prompt, maxTokens, temperature)
    : callAnthropic(models.anthropic, system, prompt, maxTokens, temperature);
}

// POST /api/ai — generate blocks from a prompt
export async function POST(req: Request) {
  return withRole("EDITOR", async (_ws) => {
    const providers = available();
    if (!providers.length) {
      return badRequest("No AI provider configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.");
    }

    const body = await req.json().catch(() => ({}));
    const mode =
      body.mode === "rewrite" ? "rewrite" : body.mode === "page" ? "page" : "generate";
    const provider = providers.includes(body.provider) ? body.provider : providers[0];

    try {
      // --- rewrite / improve text ---
      if (mode === "rewrite") {
        const text = String(body.text || "").slice(0, 4000).trim();
        if (!text) return badRequest("No text to rewrite");
        const instruction = REWRITE_INSTRUCTIONS[body.action as string] ?? REWRITE_INSTRUCTIONS.improve;
        if (provider === "mock") {
          return json({ provider, text: `${text} (improved)` });
        }
        const out = await callModel(provider, REWRITE_MODEL, REWRITE_SYSTEM, `${instruction}:\n\n${text}`, 1000, 0.5);
        const cleaned = out.trim().replace(/^["']|["']$/g, "");
        if (!cleaned) return error(422, "No rewrite returned");
        return json({ provider, text: cleaned });
      }

      // --- generate section(s) or a whole page ---
      const prompt = String(body.prompt || "").slice(0, 1000).trim();
      if (!prompt) return badRequest("Prompt is required");
      const isPage = mode === "page";
      if (provider === "mock") {
        return json({ provider, blocks: sanitizeGeneratedBlocks(isPage ? MOCK_PAGE : MOCK_BLOCKS) });
      }
      const style = DESIGN_STYLE_KEYS.includes(body.style) ? body.style : "auto";
      const system = isPage ? pageSystemPrompt(style) : sectionSystemPrompt(style);
      // styled output is larger; give it room. Higher temperature → more distinctive.
      const raw = await callModel(provider, GEN_MODEL, system, prompt, isPage ? 8000 : 4000, 0.85);
      const blocks = sanitizeGeneratedBlocks(extractJsonArray(raw));
      if (!blocks.length) {
        return error(422, "The model returned no usable blocks. Try rephrasing.");
      }
      return json({ provider, blocks });
    } catch (e) {
      return error(502, e instanceof Error ? e.message : "Generation failed");
    }
  });
}
