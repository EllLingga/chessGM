import { Chess } from "chess.js";
// Wrapper Stockfish WASM (Web Worker, UCI). Skor selalu dari sudut pandang PUTIH.
export type Line = { multipv: number; cp?: number; mate?: number; pv: string[]; depth: number };
export type Analysis = { fen: string; lines: Line[]; best: string };

export class Engine {
  private worker: Worker;
  private chain: Promise<unknown> = Promise.resolve();
  private cache = new Map<string, Analysis>();
  private ready: Promise<void>;

  constructor() {
    this.worker = new Worker("/stockfish/stockfish.js");
    this.ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Stockfish gagal dimuat")), 20000);
      const h = (e: MessageEvent) => {
        if (String(e.data).includes("readyok")) {
          clearTimeout(t);
          this.worker.removeEventListener("message", h);
          resolve();
        }
      };
      this.worker.addEventListener("message", h);
      this.worker.onerror = () => reject(new Error("Stockfish gagal dimuat (cek public/stockfish)"));
      this.worker.postMessage("uci");
      this.worker.postMessage("isready");
    });
  }

  analyze(fen: string, depth = 12, multipv = 2): Promise<Analysis> {
    const key = `${fen}|${depth}|${multipv}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const run = () => this.run(fen, depth, multipv).then((a) => (this.cache.set(key, a), a));
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  private async run(fen: string, depth: number, multipv: number): Promise<Analysis> {
    await this.ready;
    const sign = fen.split(" ")[1] === "w" ? 1 : -1;
    return new Promise((resolve) => {
      const lines = new Map<number, Line>();
      const h = (e: MessageEvent) => {
        const s = String(e.data);
        if (s.startsWith("info") && s.includes(" pv ") && s.includes(" score ")) {
          const g = (re: RegExp) => s.match(re)?.[1];
          const mpv = Number(g(/multipv (\d+)/) ?? 1);
          const line: Line = {
            multipv: mpv,
            depth: Number(g(/depth (\d+)/) ?? 0),
            pv: s.split(" pv ")[1].trim().split(" "),
          };
          const cp = g(/score cp (-?\d+)/);
          const mate = g(/score mate (-?\d+)/);
          if (cp !== undefined) line.cp = Number(cp) * sign;
          if (mate !== undefined) line.mate = Number(mate) * sign;
          lines.set(mpv, line);
        } else if (s.startsWith("bestmove")) {
          this.worker.removeEventListener("message", h);
          const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          resolve({ fen, lines: sorted, best: s.split(" ")[1] });
        }
      };
      this.worker.addEventListener("message", h);
      this.worker.postMessage("ucinewgame");
      this.worker.postMessage(`setoption name MultiPV value ${multipv}`);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  terminate() { this.worker.terminate(); }
}

export function lineToCp(l?: Line): number {
  if (!l) return 0;
  if (l.mate !== undefined) return (l.mate > 0 ? 1 : -1) * (10000 - Math.min(Math.abs(l.mate), 100) * 10);
  return l.cp ?? 0;
}

export function formatEval(l?: Line): string {
  if (!l) return "…";
  return formatCp(lineToCp(l));
}

/** Peluang menang putih (0..100), rumus Lichess. */
export function winPct(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function formatCp(cp: number): string {
  if (Math.abs(cp) >= 10000) return cp > 0 ? "1-0" : "0-1";
  if (Math.abs(cp) >= 9000) return `${cp < 0 ? "-" : ""}M${Math.round((10000 - Math.abs(cp)) / 10)}`;
  const v = cp / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** Analisis yang menangani posisi terminal (skakmat / remis) tanpa memanggil engine. */
export async function analyzeFen(eng: Engine, fen: string, depth = 12, multipv = 2): Promise<Analysis> {
  const g = new Chess(fen);
  if (g.isCheckmate()) return { fen, best: "(none)", lines: [{ multipv: 1, cp: g.turn() === "w" ? -10000 : 10000, pv: [], depth: 0 }] };
  if (g.isDraw() || g.isStalemate()) return { fen, best: "(none)", lines: [{ multipv: 1, cp: 0, pv: [], depth: 0 }] };
  return eng.analyze(fen, depth, multipv);
}
