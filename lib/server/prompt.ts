export const DIFFICULTY: Record<string, { elo: number; text: string }> = {
  beginner: { elo: 600, text: "Play like a beginner of about 600 Elo: develop pieces naively, sometimes overlook tactics, and occasionally make natural but weak moves. Do NOT play perfectly." },
  intermediate: { elo: 1200, text: "Play like a club player of about 1200 Elo: sound basics, but miss deeper tactics sometimes. Do NOT play perfectly." },
  advanced: { elo: 1800, text: "Play like a strong amateur of about 1800 Elo: solid tactics and strategy, with occasional inaccuracies." },
  expert: { elo: 2200, text: "Play like an expert of about 2200 Elo: precise and tactically alert." },
  grandmaster: { elo: 2700, text: "Play the strongest move you can find, like a grandmaster." },
};

export function buildPrompts(o: {
  fen: string; pgn: string; history: string[]; legal: { uci: string; san: string }[];
  side: "White" | "Black"; feedback?: string; difficulty?: string; customSystem?: string | null;
}) {
  let system =
    `You are a chess player in a live game. You receive the position as FEN, the PGN so far and the complete list of legal moves.\n` +
    `Choose exactly ONE move from the legal move list. Respond with ONLY a JSON object, no markdown fences, no extra text:\n` +
    `{"move":"e2e4","comment":"one short sentence explaining the move","confidence":0.0}\n` +
    `"move" must be UCI (e.g. e2e4, g1f3, e7e8q for promotion) and must appear in the legal moves list. "confidence" is a number from 0 to 1. ` +
    `Keep "comment" to a brief public explanation; do not include your private reasoning.`;
  const d = o.difficulty && DIFFICULTY[o.difficulty];
  if (d) system += `\n\nDifficulty: ${d.text}`;
  if (o.customSystem) system += `\n\n${o.customSystem}`;
  const hist = o.history.length ? o.history.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(" ") : "(game start)";
  let user =
    `You are playing ${o.side}. Side to move: ${o.side}.\n` +
    `FEN: ${o.fen}\n` +
    `PGN: ${o.pgn || "(none)"}\n` +
    `Moves so far (SAN): ${hist}\n` +
    `Legal moves (UCI): ${o.legal.map((m) => m.uci).join(" ")}\n` +
    `Legal moves (SAN): ${o.legal.map((m) => m.san).join(" ")}`;
  if (o.feedback) user += `\n\nIMPORTANT: ${o.feedback}`;
  user += `\n\nReply with the JSON object only.`;
  return { system, user };
}

/** Ambil objek JSON dari teks respons (toleran terhadap ```json fence / teks tambahan). */
export function parseJson(text: string): any {
  const clean = text.replace(/```json|```/gi, "").trim();
  try { return JSON.parse(clean); } catch {}
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch {} }
  return null;
}
