import { Chess, Square } from "chess.js";
import { Analysis, lineToCp, winPct } from "./engine";

export type Category =
  | "book" | "brilliant" | "great" | "best" | "excellent" | "good"
  | "inaccuracy" | "mistake" | "blunder" | "missedwin" | "forced";

// Semua ambang dapat diubah. Satuan: poin win% yang hilang dari sudut pandang pemain yang melangkah.
export const DEFAULT_RULES = {
  excellentMax: 2,
  goodMax: 5,
  inaccuracyMax: 10,
  mistakeMax: 20,           // di atas ini = blunder
  greatGap: 15,             // langkah terbaik, alternatif ke-2 minimal segini lebih buruk
  brilliantMaxLoss: 2,
  brilliantMinSacValue: 3,  // bidak yang dikorbankan minimal knight/bishop
  brilliantNotWinningAbove: 90, // jika sudah menang telak sebelumnya, bukan brilliant
  brilliantNotLostBelow: 25,
  missedWinBefore: 85, missedWinAfter: 65,
};
export type Rules = typeof DEFAULT_RULES;

export const META: Record<Category, { label: string; icon: string; color: string }> = {
  brilliant: { label: "Brilliant", icon: "!!", color: "#1baca6" },
  great: { label: "Great", icon: "!", color: "#5c8bb0" },
  best: { label: "Best", icon: "★", color: "#10b981" },
  excellent: { label: "Excellent", icon: "✓", color: "#34d399" },
  good: { label: "Good", icon: "✓", color: "#86a873" },
  inaccuracy: { label: "Inaccuracy", icon: "?!", color: "#f0c15c" },
  mistake: { label: "Mistake", icon: "?", color: "#e58f2a" },
  blunder: { label: "Blunder", icon: "??", color: "#ca3431" },
  missedwin: { label: "Missed Win", icon: "✗", color: "#dbac16" },
  forced: { label: "Forced", icon: "→", color: "#9ca3af" },
  book: { label: "Book", icon: "📖", color: "#a88865" },
};

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export type Classification = {
  category: Category;
  cpLoss: number;
  winLoss: number;
  bestUci: string;
  reason: string;
};

/** before = analisis posisi sebelum langkah (MultiPV>=2), after = analisis posisi sesudah langkah. */
export function classify(
  fenBefore: string, uci: string, before: Analysis, after: Analysis,
  rules: Rules = DEFAULT_RULES
): Classification {
  const game = new Chess(fenBefore);
  const moverIsWhite = game.turn() === "w";
  const side = moverIsWhite ? 1 : -1;
  const legalCount = game.moves().length;

  const bestLine = before.lines[0];
  const bestCp = lineToCp(bestLine) * side;
  const afterCp = lineToCp(after.lines[0]) * side;
  const cpLoss = Math.max(0, bestCp - afterCp);
  const wBefore = winPct(bestCp);
  const wAfter = winPct(afterCp);
  const winLoss = Math.max(0, wBefore - wAfter);
  const bestUci = before.best;
  const isBest = uci === bestUci;

  const mk = (category: Category, reason: string): Classification => ({ category, cpLoss, winLoss, bestUci, reason });

  if (legalCount === 1) return mk("forced", "Satu-satunya langkah legal.");

  if (wBefore >= rules.missedWinBefore && wAfter < rules.missedWinAfter && !isBest)
    return mk("missedwin", `Posisi menang (${wBefore.toFixed(0)}%) turun menjadi ${wAfter.toFixed(0)}%.`);

  // Brilliant: pengorbanan material + tidak kehilangan evaluasi + posisi tidak sudah menang/kalah
  const mv = game.move(uci.length === 5
    ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] } : { from: uci.slice(0, 2), to: uci.slice(2, 4) });
  const moved = mv.piece;
  const sacValue = VAL[moved] ?? 0;
  const dest = mv.to as Square;
  const opp = game.turn();
  const attacked = game.isAttacked(dest, opp);
  const capturedVal = mv.captured ? VAL[mv.captured] : 0;
  const isSacrifice = attacked && sacValue >= rules.brilliantMinSacValue && sacValue > capturedVal;
  if (
    isSacrifice && winLoss <= rules.brilliantMaxLoss &&
    wBefore < rules.brilliantNotWinningAbove && wAfter > rules.brilliantNotLostBelow
  ) return mk("brilliant", `Mengorbankan ${moved.toUpperCase()} namun evaluasi tetap terjaga (kehilangan ${winLoss.toFixed(1)}% win).`);

  if (isBest) {
    const second = before.lines[1];
    if (second) {
      const gap = winPct(bestCp) - winPct(lineToCp(second) * side);
      if (gap >= rules.greatGap) return mk("great", `Satu-satunya langkah kuat; alternatif terbaik berikutnya ${gap.toFixed(0)}% lebih buruk.`);
    }
    return mk("best", "Sama dengan langkah terbaik Stockfish.");
  }

  if (winLoss <= rules.excellentMax) return mk("excellent", `Hanya kehilangan ${winLoss.toFixed(1)}% win.`);
  if (winLoss <= rules.goodMax) return mk("good", `Kehilangan ${winLoss.toFixed(1)}% win.`);
  if (winLoss <= rules.inaccuracyMax) return mk("inaccuracy", `Kehilangan ${winLoss.toFixed(1)}% win.`);
  if (winLoss <= rules.mistakeMax) return mk("mistake", `Kehilangan ${winLoss.toFixed(1)}% win.`);
  return mk("blunder", `Kehilangan ${winLoss.toFixed(1)}% win (${(cpLoss / 100).toFixed(2)} pion).`);
}
