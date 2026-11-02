import { Chess } from "chess.js";
import { Engine, analyzeFen, lineToCp } from "./engine";
import { classify, Category } from "./classify";
import { detectOpening } from "./openings";
import type { AnalysisRec, ClsRec } from "./types";

export const CATS: Category[] = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "mistake", "blunder", "missedwin", "forced"];

export function replay(sans: string[]) {
  const g = new Chess();
  const fens = [g.fen()], ucis: string[] = [];
  for (const s of sans) {
    const m = g.move(s);
    ucis.push(m.from + m.to + (m.promotion ?? ""));
    fens.push(g.fen());
  }
  return { fens, ucis };
}

const mv = (u: string) => (u.length === 5 ? { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] } : { from: u.slice(0, 2), to: u.slice(2, 4) });

/** Analisis seluruh game dengan Stockfish (tiap posisi dianalisis sekali, MultiPV 2). */
export async function reviewGame(engine: Engine, sans: string[], onProgress?: (done: number, total: number) => void, depth = 11): Promise<AnalysisRec> {
  const { fens, ucis } = replay(sans);
  const A = [];
  for (let i = 0; i < fens.length; i++) {
    A.push(await analyzeFen(engine, fens[i], depth, 2));
    onProgress?.(i + 1, fens.length);
  }
  const book = detectOpening(sans)?.plies ?? 0;
  const counts: any = { w: {}, b: {} };
  const accSum = { w: 0, b: 0 }, cpSum = { w: 0, b: 0 }, n = { w: 0, b: 0 };
  const classes: ClsRec[] = [];
  for (let i = 0; i < ucis.length; i++) {
    const side = i % 2 === 0 ? "w" : "b";
    const c = classify(fens[i], ucis[i], A[i], A[i + 1]);
    const category = i < book ? "book" : c.category;
    let bestSan = "";
    if (A[i].best && A[i].best !== "(none)") { try { bestSan = new Chess(fens[i]).move(mv(A[i].best)).san; } catch {} }
    classes.push({ category, cpLoss: Math.round(c.cpLoss), winLoss: Math.round(c.winLoss * 10) / 10, bestUci: c.bestUci, bestSan, reason: i < book ? "Langkah teori pembukaan." : c.reason });
    counts[side][category] = (counts[side][category] ?? 0) + 1;
    accSum[side] += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * c.winLoss) - 3.1669));
    cpSum[side] += Math.min(1000, c.cpLoss);
    n[side]++;
  }
  const avg = (a: number, k: number) => (k ? Math.round((a / k) * 10) / 10 : 0);
  return {
    depth,
    evals: A.map((a) => Math.max(-10000, Math.min(10000, Math.round(lineToCp(a.lines[0]))))),
    classes,
    acc: { w: avg(accSum.w, n.w), b: avg(accSum.b, n.b) },
    acpl: { w: Math.round(avg(cpSum.w, n.w)), b: Math.round(avg(cpSum.b, n.b)) },
    counts,
  };
}
