import { Chess } from "chess.js";
import { api } from "./api";

export class AiError extends Error {}
export type MoveResult = { uci: string; san: string; comment?: string; confidence?: number; ms: number; inTokens: number; outTokens: number; attempts: number; http?: number };
export type StatusInfo = { attempt: number; total: number; message: string; httpStatus?: number };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); });
  });

/** Meminta langkah dari AI via backend. Langkah divalidasi chess.js di server; ilegal → feedback + retry. */
export async function getAiMove(o: {
  profileId: string; game: Chess; maxRetries: number; difficulty?: string; signal?: AbortSignal; onStatus?: (s: StatusInfo) => void;
}): Promise<MoveResult> {
  const t0 = Date.now();
  const total = Math.max(1, o.maxRetries + 1);
  let feedback: string | undefined, inT = 0, outT = 0, lastErr = "";
  for (let a = 1; a <= total; a++) {
    o.onStatus?.({ attempt: a, total, message: a === 1 ? "Thinking…" : `Retry ${a - 1}/${o.maxRetries} — ${lastErr.slice(0, 60)}` });
    let r: any;
    try {
      r = await api("/api/move", {
        method: "POST", signal: o.signal,
        body: JSON.stringify({ profileId: o.profileId, fen: o.game.fen(), pgn: o.game.pgn(), history: o.game.history(), feedback, difficulty: o.difficulty }),
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      lastErr = e.message;
      if (e.config) throw new AiError(e.message);
      await sleep(1000 * a, o.signal);
      continue;
    }
    inT += r.inTokens ?? 0; outT += r.outTokens ?? 0;
    o.onStatus?.({ attempt: a, total, message: r.ok ? "Move received" : `Rejected: ${r.kind}`, httpStatus: r.status });
    if (r.ok) return { uci: r.uci, san: r.san, comment: r.comment, confidence: r.confidence, ms: Date.now() - t0, inTokens: inT, outTokens: outT, attempts: a, http: r.status };
    lastErr = r.error;
    if (r.kind === "api_error") {
      if ([400, 401, 403, 404].includes(r.status)) throw new AiError(`API error ${r.status}: ${r.error}`);
      await sleep(1500 * a, o.signal);
    } else feedback = r.error;
  }
  throw new AiError(`Gagal setelah ${total} percobaan. Terakhir: ${lastErr}`);
}
