import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
import { Chess } from "chess.js";
import { loadProfile } from "@/lib/server/profile";
import { generate } from "@/lib/server/providers";
import { buildPrompts, parseJson } from "@/lib/server/prompt";
import { ProviderError, UserError } from "@/lib/server/errors";
export const maxDuration = 60;

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export const POST = handle(async (req: NextRequest) => {
  if (limited(req, "move", 120, 60_000)) return json({ error: "Rate limit terlampaui, tunggu sebentar." }, 429);
  const b = await req.json();
  let game: Chess;
  try { game = new Chess(String(b.fen)); } catch { throw new UserError("FEN tidak valid"); }
  if (game.isGameOver()) throw new UserError("Permainan sudah selesai");
  const verbose = game.moves({ verbose: true });
  const legal = verbose.map((m: any) => ({ uci: m.from + m.to + (m.promotion ?? ""), san: m.san }));
  const p = await loadProfile(String(b.profileId));
  const { system, user } = buildPrompts({
    fen: game.fen(), pgn: String(b.pgn ?? ""), history: Array.isArray(b.history) ? b.history.map(String) : [], legal,
    side: game.turn() === "w" ? "White" : "Black", feedback: b.feedback ? String(b.feedback).slice(0, 500) : undefined,
    difficulty: b.difficulty, customSystem: p.system_prompt,
  });

  let out;
  try {
    out = await generate({
      provider: p.provider, model: p.model, apiKey: p.apiKey, baseUrl: p.base_url, temperature: p.temperature,
      maxTokens: p.max_tokens, thinkingBudget: p.thinking_budget, system, user, timeoutMs: p.timeout_s * 1000,
    });
  } catch (e: any) {
    if (e instanceof ProviderError) return json({ ok: false, kind: "api_error", error: e.message, status: e.status });
    throw e;
  }
  const meta = { ms: out.ms, status: out.status, inTokens: out.inTokens, outTokens: out.outTokens };

  const parsed = parseJson(out.text);
  if (!parsed || typeof parsed.move !== "string")
    return json({ ok: false, kind: "invalid_json", error: 'Your reply was not valid JSON with a "move" field. Reply ONLY with {"move":"e2e4","comment":"...","confidence":0.9}.', ...meta });

  // Validasi langkah SELALU oleh chess.js (bukan oleh AI)
  const raw = parsed.move.trim();
  let found = UCI.test(raw.toLowerCase()) ? legal.find((m) => m.uci === raw.toLowerCase()) : undefined;
  if (!found) {
    try {
      const m = new Chess(game.fen()).move(raw);
      found = legal.find((x) => x.san === m.san);
    } catch {}
  }
  if (!found)
    return json({ ok: false, kind: "illegal", error: `The move "${raw.slice(0, 20)}" is ILLEGAL in this position. Choose one move from the legal moves list exactly as written.`, ...meta });

  const conf = Number(parsed.confidence);
  return json({
    ok: true, uci: found.uci, san: found.san,
    comment: typeof parsed.comment === "string" ? parsed.comment.slice(0, 300) : undefined,
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : undefined, ...meta,
  });
});
