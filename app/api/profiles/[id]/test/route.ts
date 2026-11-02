import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
import { loadProfile } from "@/lib/server/profile";
import { generate } from "@/lib/server/providers";
import { ProviderError } from "@/lib/server/errors";
export const maxDuration = 60;

export const POST = handle(async (req: NextRequest, { params }: any) => {
  if (limited(req, "test", 20, 60_000)) return json({ ok: false, error: "Rate limit" }, 429);
  const p = await loadProfile(params.id);
  try {
    const out = await generate({
      provider: p.provider, model: p.model, apiKey: p.apiKey, baseUrl: p.base_url, temperature: p.temperature,
      maxTokens: Math.max(p.max_tokens, 256), thinkingBudget: p.thinking_budget,
      system: "You are a connectivity test.", user: 'Reply with exactly this JSON: {"ok":true}', timeoutMs: p.timeout_s * 1000,
    });
    return json({ ok: true, ms: out.ms, status: out.status, inTokens: out.inTokens, outTokens: out.outTokens });
  } catch (e: any) {
    if (e instanceof ProviderError) return json({ ok: false, error: e.message, status: e.status });
    throw e;
  }
});
