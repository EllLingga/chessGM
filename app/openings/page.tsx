"use client";
import { useEffect, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import InteractiveBoard from "@/components/InteractiveBoard";
import MoveList from "@/components/MoveList";
import { api } from "@/lib/api";
import { OPENINGS, POPULAR, detectOpening } from "@/lib/openings";
import { replay } from "@/lib/review";
import { play as sfx, soundForMove } from "@/lib/sound";

type Row = { san: string; total: number; white: number; draws: number; black: number };

export default function Openings() {
  const [moves, setMoves] = useState<string[]>([]);
  const [stats, setStats] = useState<{ total: number; white: number; draws: number; black: number; next: Row[] } | null>(null);
  const [err, setErr] = useState("");
  const fen = useMemo(() => replay(moves).fens.at(-1)!, [moves]);
  const op = detectOpening(moves);

  useEffect(() => {
    let off = false;
    api("/api/openings", { method: "POST", body: JSON.stringify({ moves }) })
      .then((s) => { if (!off) { setStats(s); setErr(""); } }).catch((e) => !off && setErr(e.message));
    return () => { off = true; };
  }, [moves]);

  function onMove(from: Square, to: Square, promotion?: string) {
    const g = new Chess(fen); const m = g.move({ from, to, promotion });
    setMoves((p) => [...p, m.san]); sfx(soundForMove(g, m));
  }
  const pct = (a: number, t: number) => (t ? Math.round((a / t) * 100) : 0);
  const lineFrom = (s: string) => s.split(" ");
  const nextOpenings = OPENINGS.filter((o) => { const l = lineFrom(o.moves); return l.length > moves.length && moves.every((m, i) => l[i] === m.replace(/[+#]/g, "")); })
    .filter((o, i, a) => a.findIndex((x) => x.name === o.name && x.moves === o.moves) === i).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <InteractiveBoard id="openings" fen={fen} enabled onMove={onMove} lastMove={null} />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn" onClick={() => setMoves((m) => m.slice(0, -1))} disabled={!moves.length}>◀ Undo</button>
          <button className="btn" onClick={() => setMoves([])} disabled={!moves.length}>Reset</button>
        </div>
        <section className="card mt-3">
          <h2 className="h-sec">PEMBUKAAN POPULER</h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map((o) => <button key={o.eco + o.name} className="btn" onClick={() => setMoves(lineFrom(o.moves))}>{o.name.split(":")[0]}</button>)}
          </div>
        </section>
      </div>
      <aside className="space-y-4">
        <section className="card">
          <h2 className="h-sec">OPENING</h2>
          <p className="font-semibold">{op ? op.name : moves.length ? "Tidak dikenali" : "Posisi awal"}</p>
          <p className="text-xs text-neutral-400">{op ? `ECO ${op.eco}` : "—"}</p>
          <div className="mt-2 max-h-28 overflow-auto"><MoveList sans={moves} view={moves.length} onSelect={(n) => setMoves((m) => m.slice(0, n))} /></div>
        </section>
        <section className="card">
          <h2 className="h-sec">STATISTIK DARI GAME GRANDMASTER</h2>
          {err ? <p className="text-sm text-red-400">{err}</p> : !stats ? <p className="text-sm text-neutral-400">Memuat…</p> : stats.total === 0 ? (
            <p className="text-sm text-neutral-400">Belum ada game tersimpan yang melewati posisi ini. Statistik dihitung dari pertandingan yang kamu mainkan di sini.</p>
          ) : (
            <>
              <p className="text-sm mb-2">{stats.total} game · W {pct(stats.white, stats.total)}% · D {pct(stats.draws, stats.total)}% · B {pct(stats.black, stats.total)}%</p>
              <table className="w-full text-sm"><tbody>
                {stats.next.map((r) => (
                  <tr key={r.san} className="cursor-pointer hover:bg-neutral-800" onClick={() => { try { const g = new Chess(fen); g.move(r.san); setMoves((p) => [...p, r.san]); } catch {} }}>
                    <td className="py-1 pr-2 font-mono">{r.san}</td><td className="pr-2 text-neutral-400">{r.total}</td>
                    <td className="w-full"><div className="flex h-3 overflow-hidden rounded text-[9px]">
                      <div style={{ width: `${pct(r.white, r.total)}%` }} className="bg-neutral-100" /><div style={{ width: `${pct(r.draws, r.total)}%` }} className="bg-neutral-500" /><div style={{ width: `${pct(r.black, r.total)}%` }} className="bg-neutral-800 border border-neutral-600" /></div></td>
                  </tr>
                ))}
              </tbody></table>
            </>
          )}
        </section>
        {nextOpenings.length > 0 && (
          <section className="card">
            <h2 className="h-sec">LANJUTAN DALAM TABEL ECO</h2>
            <ul className="text-sm space-y-1">{nextOpenings.map((o) => (
              <li key={o.eco + o.moves}><button className="hover:underline text-left" onClick={() => setMoves(lineFrom(o.moves))}><span className="text-accent">{o.eco}</span> {o.name}</button></li>
            ))}</ul>
          </section>
        )}
      </aside>
    </div>
  );
}
