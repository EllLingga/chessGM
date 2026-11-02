"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, Square } from "chess.js";
import InteractiveBoard from "@/components/InteractiveBoard";
import EvalBar from "@/components/EvalBar";
import MoveList from "@/components/MoveList";
import { Engine, Analysis, analyzeFen, formatEval } from "@/lib/engine";
import { classify, Classification, META } from "@/lib/classify";
import { detectOpening } from "@/lib/openings";
import { play as sfx, soundForMove } from "@/lib/sound";

const START = new Chess().fen();
type Mv = { san: string; uci: string; before: string; after: string; cls?: Classification };

export default function AnalysisPage() {
  const engineRef = useRef<Engine | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [moves, setMoves] = useState<Mv[]>([]);
  const [view, setView] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [live, setLive] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [pgnText, setPgnText] = useState(""); const [showImport, setShowImport] = useState(false); const [importErr, setImportErr] = useState("");

  useEffect(() => {
    try { engineRef.current = new Engine(); } catch (e) { setEngineError(String(e)); }
    return () => engineRef.current?.terminate();
  }, []);

  const fen = view === 0 ? START : moves[view - 1].after;
  const atEnd = view === moves.length;
  const current = view > 0 ? moves[view - 1] : null;

  useEffect(() => {
    const eng = engineRef.current; if (!eng) return;
    let off = false; setBusy(true);
    analyzeFen(eng, fen, 14, 3).then((a) => { if (!off) { setLive(a); setBusy(false); } })
      .catch((e) => { if (!off) { setEngineError(String(e.message ?? e)); setBusy(false); } });
    return () => { off = true; };
  }, [fen]);

  async function classifyAt(idx: number, mv: Mv) {
    const eng = engineRef.current; if (!eng) return;
    try {
      const [b, a] = await Promise.all([analyzeFen(eng, mv.before, 14, 2), analyzeFen(eng, mv.after, 14, 1)]);
      const cls = classify(mv.before, mv.uci, b, a);
      setMoves((p) => p.map((x, i) => (i === idx ? { ...x, cls } : x)));
    } catch (e: any) { setEngineError(String(e.message ?? e)); }
  }

  function onMove(from: Square, to: Square, promotion?: string) {
    if (!atEnd) return;
    const g = new Chess(fen);
    const m = g.move({ from, to, promotion });
    const mv: Mv = { san: m.san, uci: from + to + (m.promotion ?? ""), before: fen, after: g.fen() };
    const idx = moves.length;
    setMoves((p) => [...p, mv]); setView(idx + 1); sfx(soundForMove(g, m));
    classifyAt(idx, mv);
  }

  function importPgn() {
    setImportErr("");
    try {
      const g = new Chess(); g.loadPgn(pgnText.trim());
      const h = g.history({ verbose: true }) as any[];
      if (!h.length) throw new Error("PGN tidak berisi langkah");
      const list: Mv[] = h.map((m) => ({ san: m.san, uci: m.from + m.to + (m.promotion ?? ""), before: m.before, after: m.after }));
      setMoves(list); setView(list.length); setShowImport(false);
      (async () => { for (let i = 0; i < list.length; i++) await classifyAt(i, list[i]); })();
    } catch (e: any) { setImportErr("PGN tidak valid: " + (e.message ?? e)); }
  }

  const status = useMemo(() => {
    const g = new Chess(fen);
    return g.isCheckmate() ? `Skakmat — ${g.turn() === "w" ? "Hitam" : "Putih"} menang` : g.isStalemate() ? "Remis (stalemate)" : g.isDraw() ? "Remis" : g.inCheck() ? "Skak" : "";
  }, [fen]);

  function exportPgn() {
    const g = new Chess();
    moves.forEach((m) => g.move(m.san));
    const blob = new Blob([g.pgn()], { type: "application/x-chess-pgn" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "grandmaster-game.pgn"; a.click(); URL.revokeObjectURL(a.href);
  }

  const top = live?.lines[0];
  const bestSan = useMemo(() => {
    if (!live?.best || live.best === "(none)") return "";
    try { return new Chess(live.fen).move({ from: live.best.slice(0, 2), to: live.best.slice(2, 4), promotion: live.best[4] }).san; } catch { return ""; }
  }, [live]);
  const opening = detectOpening(moves.slice(0, view).map((m) => m.san));

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div className="flex gap-2">
          <EvalBar line={top} flipped={flipped} />
          <div className="flex-1 min-w-0">
            <InteractiveBoard id="analysis" fen={fen} orientation={flipped ? "black" : "white"} enabled={atEnd} onMove={onMove} lastMove={current?.uci} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={() => setView(0)} disabled={view === 0}>⏮</button>
          <button className="btn" onClick={() => setView((v) => Math.max(0, v - 1))} disabled={view === 0}>◀</button>
          <button className="btn" onClick={() => setView((v) => Math.min(moves.length, v + 1))} disabled={atEnd}>▶</button>
          <button className="btn" onClick={() => setView(moves.length)} disabled={atEnd}>⏭</button>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>Flip</button>
          <button className="btn" onClick={() => { setMoves([]); setView(0); }}>Reset</button>
          <button className="btn" onClick={() => setShowImport((s) => !s)}>Import PGN</button>
          <button className="btn" onClick={exportPgn} disabled={!moves.length}>Export PGN</button>
        </div>
        {showImport && (
          <div className="mt-3 space-y-2">
            <textarea className="input min-h-[100px] font-mono" placeholder="Tempel PGN di sini" value={pgnText} onChange={(e) => setPgnText(e.target.value)} />
            {importErr && <p className="text-sm text-red-400">{importErr}</p>}
            <button className="btn-primary" onClick={importPgn} disabled={!pgnText.trim()}>Muat & Analisis</button>
          </div>
        )}
        {status && <p className="mt-2 text-accent font-semibold">{status}</p>}
      </div>

      <aside className="space-y-4">
        <section className="card">
          <h2 className="h-sec">STOCKFISH {busy && "· menganalisis…"}</h2>
          {engineError ? <p className="text-sm text-red-400">{engineError}</p> : (
            <dl className="text-sm grid grid-cols-2 gap-y-1">
              <dt className="text-neutral-400">Evaluasi</dt><dd className="font-mono">{formatEval(top)}</dd>
              <dt className="text-neutral-400">Langkah terbaik</dt><dd className="font-mono">{bestSan || "—"}</dd>
              <dt className="text-neutral-400">Depth</dt><dd className="font-mono">{top?.depth || "—"}</dd>
              <dt className="text-neutral-400">Pembukaan</dt><dd>{opening ? `${opening.eco} ${opening.name}` : "—"}</dd>
            </dl>
          )}
          {live && live.lines.length > 1 && (
            <ul className="mt-3 text-xs font-mono text-neutral-400 space-y-1">
              {live.lines.map((l) => <li key={l.multipv}>{formatEval(l)} · {l.pv.slice(0, 5).join(" ")}</li>)}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="h-sec">KLASIFIKASI LANGKAH</h2>
          {current ? (current.cls ? (
            <div className="text-sm space-y-1">
              <p style={{ color: META[current.cls.category].color }} className="font-semibold">{META[current.cls.category].icon} {META[current.cls.category].label} — {current.san}</p>
              <p className="text-neutral-300">{current.cls.reason}</p>
              <p className="text-neutral-400">Centipawn loss: <span className="font-mono">{Math.round(current.cls.cpLoss)}</span></p>
              <p className="text-neutral-400">Engine best: <span className="font-mono">{current.cls.bestUci}</span></p>
            </div>
          ) : <p className="text-sm text-neutral-400">Menghitung…</p>) : <p className="text-sm text-neutral-400">Mainkan atau pilih sebuah langkah.</p>}
        </section>
        <section className="card !p-2 max-h-80 overflow-auto">
          <MoveList sans={moves.map((m) => m.san)} cats={moves.map((m) => m.cls?.category)} view={view} onSelect={setView} />
        </section>
      </aside>
    </div>
  );
}
