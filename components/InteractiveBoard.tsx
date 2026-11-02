"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";

const Chessboard: any = dynamic(() => import("react-chessboard").then((m) => m.Chessboard), {
  ssr: false,
  loading: () => <div className="aspect-square w-full rounded bg-neutral-900 animate-pulse" />,
});

type Props = {
  fen: string; orientation?: "white" | "black"; enabled?: boolean;
  onMove?: (from: Square, to: Square, promotion?: string) => void; lastMove?: string | null; id?: string;
};

export default function InteractiveBoard({ fen, orientation = "white", enabled = false, onMove, lastMove, id = "board" }: Props) {
  const game = useMemo(() => new Chess(fen), [fen]);
  const [sel, setSel] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  useEffect(() => { setSel(null); setPromo(null); }, [fen]);

  const isPromo = (from: Square, to: Square) => {
    const p = game.get(from);
    return p?.type === "p" && ((p.color === "w" && to[1] === "8") || (p.color === "b" && to[1] === "1"));
  };
  const legalTo = (from: Square, to: Square) => game.moves({ square: from, verbose: true }).some((m: any) => m.to === to);

  function tryMove(from: Square, to: Square): boolean {
    if (!enabled || !legalTo(from, to)) return false;
    if (isPromo(from, to)) { setPromo({ from, to }); return false; }
    onMove?.(from, to);
    return true;
  }
  function onSquareClick(sq: Square) {
    if (!enabled) return;
    if (sel && tryMove(sel, sq)) return;
    if (sel && promo) return;
    const p = game.get(sq);
    setSel(p && p.color === game.turn() ? sq : null);
  }

  const styles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) { const h = { background: "rgba(16,185,129,0.38)" }; s[lastMove.slice(0, 2)] = h; s[lastMove.slice(2, 4)] = h; }
    if (game.inCheck()) {
      const k = game.board().flat().find((p: any) => p && p.type === "k" && p.color === game.turn());
      if (k) s[k.square] = { background: "radial-gradient(circle, rgba(220,38,38,.85), transparent 70%)" };
    }
    if (sel) {
      s[sel] = { background: "rgba(250,204,21,0.45)" };
      game.moves({ square: sel, verbose: true }).forEach((m: any) => {
        s[m.to] = { background: m.captured ? "radial-gradient(circle, transparent 55%, rgba(0,0,0,.35) 56%)" : "radial-gradient(circle, rgba(0,0,0,.3) 22%, transparent 24%)" };
      });
    }
    return s;
  }, [lastMove, game, sel]);

  const white = game.turn() === "w";
  const glyph: Record<string, string> = white ? { q: "♕", r: "♖", b: "♗", n: "♘" } : { q: "♛", r: "♜", b: "♝", n: "♞" };

  return (
    <div className="relative w-full">
      <Chessboard
        id={id} position={fen} boardOrientation={orientation} arePiecesDraggable={enabled}
        onPieceDrop={(from: Square, to: Square) => tryMove(from, to)} onSquareClick={onSquareClick}
        customSquareStyles={styles} animationDuration={200}
        customDarkSquareStyle={{ backgroundColor: "#4a7c59" }} customLightSquareStyle={{ backgroundColor: "#f0ead2" }}
        customBoardStyle={{ borderRadius: 6, boxShadow: "0 4px 24px rgba(0,0,0,.5)" }}
      />
      {promo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded">
          <div className="flex gap-2 rounded-xl bg-panel p-3 border border-line">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button key={p} className="h-14 w-14 rounded-lg bg-neutral-800 text-4xl hover:bg-accent hover:text-black"
                onClick={() => { const pr = promo; setPromo(null); onMove?.(pr.from, pr.to, p); }}>{glyph[p]}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
