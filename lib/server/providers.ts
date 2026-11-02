import { ProviderError } from "./errors";

export type GenInput = {
  provider: string; model: string; apiKey: string; baseUrl?: string | null;
  temperature?: number | null; maxTokens: number; thinkingBudget?: number | null;
  system: string; user: string; timeoutMs: number;
};
export type GenOutput = { text: string; inTokens?: number; outTokens?: number; status: number; ms: number };

const scrub = (s: string, secret: string) => (secret ? s.split(secret).join("***") : s);

async function post(url: string, headers: Record<string, string>, body: any, timeoutMs: number, secret: string) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ac.signal });
    const txt = await r.text();
    let j: any;
    try { j = JSON.parse(txt); } catch {}
    if (!r.ok) {
      const raw = j?.error?.message ?? j?.error ?? j?.message ?? txt.slice(0, 300);
      throw new ProviderError(scrub(typeof raw === "string" ? raw : JSON.stringify(raw), secret), r.status);
    }
    if (!j) throw new ProviderError("Respons API bukan JSON", r.status);
    return { j, status: r.status, ms: Date.now() - t0 };
  } catch (e: any) {
    if (e instanceof ProviderError) throw e;
    if (e?.name === "AbortError") throw new ProviderError(`Timeout setelah ${Math.round(timeoutMs / 1000)} detik`, 408);
    throw new ProviderError(scrub(String(e?.message ?? e), secret), 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function generate(i: GenInput): Promise<GenOutput> {
  if (i.provider === "anthropic") return anthropic(i);
  if (i.provider === "gemini") return gemini(i);
  return openaiCompat(i);
}

async function openaiCompat(i: GenInput): Promise<GenOutput> {
  const base = i.provider === "openai" ? "https://api.openai.com/v1" : i.provider === "deepseek" ? "https://api.deepseek.com" : (i.baseUrl || "").replace(/\/+$/, "");
  if (!base) throw new ProviderError("Base URL belum diisi", 400);
  const reasoning = i.provider === "openai" && /^(o\d|gpt-5)/i.test(i.model);
  const dsReasoner = i.provider === "deepseek" && /reasoner|r1/i.test(i.model);
  const body: any = { model: i.model, messages: [{ role: "system", content: i.system }, { role: "user", content: i.user }] };
  if (i.provider === "openai") body.max_completion_tokens = i.maxTokens; else body.max_tokens = i.maxTokens;
  if (!reasoning && !dsReasoner && i.temperature != null) body.temperature = i.temperature;
  if (reasoning && i.thinkingBudget) body.reasoning_effort = i.thinkingBudget <= 2000 ? "low" : i.thinkingBudget <= 8000 ? "medium" : "high";
  if ((i.provider === "openai" || i.provider === "deepseek") && !dsReasoner) body.response_format = { type: "json_object" };
  const { j, status, ms } = await post(`${base}/chat/completions`, { authorization: `Bearer ${i.apiKey}` }, body, i.timeoutMs, i.apiKey);
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError(`Respons kosong (finish_reason: ${j?.choices?.[0]?.finish_reason ?? "?"}). Coba naikkan Max tokens.`, status);
  return { text, inTokens: j.usage?.prompt_tokens, outTokens: j.usage?.completion_tokens, status, ms };
}

async function anthropic(i: GenInput): Promise<GenOutput> {
  const think = !!i.thinkingBudget && i.thinkingBudget >= 1024;
  const body: any = {
    model: i.model,
    max_tokens: think ? Math.max(i.maxTokens, i.thinkingBudget! + 1024) : i.maxTokens,
    system: i.system,
    messages: [{ role: "user", content: i.user }],
  };
  if (think) body.thinking = { type: "enabled", budget_tokens: i.thinkingBudget };
  else if (i.temperature != null) body.temperature = Math.min(1, i.temperature);
  const { j, status, ms } = await post("https://api.anthropic.com/v1/messages", { "x-api-key": i.apiKey, "anthropic-version": "2023-06-01" }, body, i.timeoutMs, i.apiKey);
  // Hanya blok "text" yang dipakai; blok thinking diabaikan (tidak ditampilkan).
  const text = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  if (!text) throw new ProviderError(`Respons kosong (stop_reason: ${j.stop_reason ?? "?"}). Coba naikkan Max tokens.`, status);
  return { text, inTokens: j.usage?.input_tokens, outTokens: j.usage?.output_tokens, status, ms };
}

async function gemini(i: GenInput): Promise<GenOutput> {
  const model = i.model.replace(/^models\//, "");
  const gc: any = { maxOutputTokens: i.maxTokens, responseMimeType: "application/json" };
  if (i.temperature != null) gc.temperature = i.temperature;
  if (i.thinkingBudget != null) gc.thinkingConfig = { thinkingBudget: i.thinkingBudget };
  const body = { systemInstruction: { parts: [{ text: i.system }] }, contents: [{ role: "user", parts: [{ text: i.user }] }], generationConfig: gc };
  const { j, status, ms } = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "x-goog-api-key": i.apiKey }, body, i.timeoutMs, i.apiKey);
  const cand = j.candidates?.[0];
  const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought && p.text).map((p: any) => p.text).join("");
  if (!text) throw new ProviderError(`Respons kosong (${cand?.finishReason ?? j.promptFeedback?.blockReason ?? "?"}). Coba naikkan Max tokens.`, status);
  const u = j.usageMetadata;
  return { text, inTokens: u?.promptTokenCount, outTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0), status, ms };
}
