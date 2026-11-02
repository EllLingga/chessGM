"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import InteractiveBoard from "@/components/InteractiveBoard";
import EvalBar from "@/components/EvalBar";
import MoveList from "@/components/MoveList";
import { api } from "@/lib/api";
import { Engine, formatCp } from "@/lib/engine";
import { META, Category } from "@/lib/classify";
import { CATS, replay, reviewGame } from "@/lib/review";
import { detectOpening } from "@/lib/openings";
import type { AnalysisRec } from "@/lib/types";

const fmtDur = (ms?: number) => (ms ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : "—");

export default function Review({ params }: { params: { id: string } }) {
  const [game, setGame] = useState<any>(null);
  const [an, setAn] = useState<AnalysisRec | null>(null);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [view, setView] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const engineRef = useRef<Engine | null>(null);

  const sans: string[] = useMemo(() => (game?.moves ?? []).map((m: any) => m.san), [game]);
  const rp = useMemo(() => (sans.length ? replay(sans) : null), [sans]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const g = await api(`/api/games/${params.id}`);
        if (dead) return;
        setGame(g); setView(0);
        if (g.analysis) { setAn(g.analysis); return; }
        const eng = new Engine(); engineRef.current = eng;
        const list = g.moves.map((m: any) => m.san);
        const res = await reviewGame(eng, list, (d, t) => !dead && setProgress([d, t]));
        if (dead) return;
        setAn(res); setProgress(null);
        api(`/api/games/${params.id}`, { method: "PUT", body: JSON.stringify({ analysis: res, accuracy_white: res.acc.w, accuracy_black: res.acc.b }) }).catch(() => {});
      } catch (e: any) { if (!dead) setErr(e.message); }
    })();
    return () => { dead = true; engineRef.current?.terminate(); };
  }, [params.id]);

  if (err) return <div className="mx-auto max-w-xl px-4 py-16 text-center text-red-400">{err}</div>;
  if (!game || !rp) return <div className="mx-auto max-w-xl px-4 py-16 text-center text-neutral-400">Memuat game…</div>;

  const opening = detectOpening(sans);
  const cls = view > 0 ? an?.classes[view - 1] : undefined;
  const meta = cls ? META[cls.category as Category] : null;
  const chart = (an?.evals ?? []).map((cp, i) => ({ i, v: Math.max(-10, Math.min(10, cp / 100)) }));
  const moveRows = an ? an.classes.map((c, i) => ({ ...c, i })) : [];
  const critical = [...moveRows].sort((a, b) => b.winLoss - a.winLoss).filter((m) => m.winLoss >= 10).slice(0, 3);
  const bestMoves = moveRows.filter((m) => m.category === "brilliant" || m.category === "great");
  const name = (side: "w" | "b") => (side === "w" ? game.white_name : game.black_name);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 space-y-4">
      <section className="card">
        <p className="text-xs tracking-widest text-neutral-400">GAME REVIEW</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold">{game.white_name} vs {game.black_name}</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Result: <span className="text-white font-semibold">{game.result}</span>{game.termination && ` (${game.termination})`} · {opening ? `${opening.eco} ${opening.name}` : "Opening tidak dikenali"} · {game.num_moves} langkah · {fmtDur(game.duration_ms)}
        </p>
        {progress && (
          <div className="mt-3"><p className="text-xs text-neutral-400 mb-1">Stockfish menganalisis posisi {progress[0]}/{progress[1]}…</p>
            <div className="h-2 rounded bg-neutral-800"><div className="h-2 rounded bg-accent transition-all" style={{ width: `${(progress[0] / progress[1]) * 100}%` }} /></div></div>
        )}
      </section>

      {an && (
        <section className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
          {(["w", "b"] as const).map((s) => (
            <div key={s} className="card text-center">
              <p className="text-xs tracking-widest text-neutral-400">{s === "w" ? "WHITE" : "BLACK"} · {name(s)}</p>
              <p className="mt-2 text-4xl font-extrabold text-accent">{an.acc[s].toFixed(1)}%</p>
              <p className="text-xs text-neutral-400 mt-1">Accuracy · ACPL {an.acpl[s]}</p>
            </div>
          ))}
          <div className="card">
            <p className="h-sec">MOVE CLASSIFICATION</p>
            <table className="w-full text-sm"><tbody>
              <tr className="text-xs text-neutral-500"><td /><td className="text-right">W</td><td className="text-right">B</td></tr>
              {CATS.map((c) => (
                <tr key={c}><td style={{ color: META[c].color }}>{META[c].icon} {META[c].label}</td>
                  <td className="text-right font-mono">{an.counts.w[c] ?? 0}</td><td className="text-right font-mono">{an.counts.b[c] ?? 0}</td></tr>
              ))}
            </tbody></table>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex gap-2">
            <EvalBar line={an ? { multipv: 1, cp: an.evals[view], pv: [], depth: 0 } : undefined} flipped={flipped} />
            <div className="flex-1 min-w-0">
              <InteractiveBoard id="review" fen={rp.fens[view]} orientation={flipped ? "black" : "white"} lastMove={view > 0 ? rp.ucis[view - 1] : null} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={() => setView(0)} disabled={view === 0}>⏮</button>
            <button className="btn" onClick={() => setView((v) => Math.max(0, v - 1))} disabled={view === 0}>◀</button>
            <button className="btn" onClick={() => setView((v) => Math.min(sans.length, v + 1))} disabled={view === sans.length}>▶</button>
            <button className="btn" onClick={() => setView(sans.length)} disabled={view === sans.length}>⏭</button>
            <button className="btn" onClick={() => setFlipped((f) => !f)}>Flip</button>
            <Link href="/history" className="btn">← History</Link>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="h-sec">DETAIL LANGKAH</h2>
            {view === 0 ? <p className="text-sm text-neutral-400">Pilih langkah dari daftar atau grafik.</p> : !an ? <p className="text-sm text-neutral-400">Menunggu analisis…</p> : cls && meta ? (
              <div className="text-sm space-y-1">
                <p className="font-semibold" style={{ color: meta.color }}>{meta.icon} {meta.label} — {sans[view - 1]}</p>
                <p className="text-neutral-300">{cls.reason}</p>
                <dl className="grid grid-cols-2 gap-y-1 pt-1">
                  <dt className="text-neutral-400">Engine best</dt><dd className="font-mono">{cls.bestSan || "—"}</dd>
                  <dt className="text-neutral-400">Actual move</dt><dd className="font-mono">{sans[view - 1]}</dd>
                  <dt className="text-neutral-400">Eval before</dt><dd className="font-mono">{formatCp(an.evals[view - 1])}</dd>
                  <dt className="text-neutral-400">Eval after</dt><dd className="font-mono">{formatCp(an.evals[view])}</dd>
                  <dt className="text-neutral-400">Centipawn loss</dt><dd className="font-mono">{cls.cpLoss}</dd>
                  <dt className="text-neutral-400">Win% loss</dt><dd className="font-mono">{cls.winLoss}</dd>
                </dl>
              </div>
            ) : null}
          </section>
          <section className="card !p-2 max-h-80 overflow-auto">
            <MoveList sans={sans} cats={an?.classes.map((c) => c.category)} view={view} onSelect={setView} />
          </section>
        </aside>
      </div>

      {an && (
        <section className="card">
          <h2 className="h-sec">EVALUATION GRAPH</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} onClick={(s: any) => { if (s?.activeLabel !== undefined) setView(Number(s.activeLabel)); }}>
                <CartesianGrid stroke="#2c2c2c" vertical={false} />
                <XAxis dataKey="i" stroke="#737373" fontSize={11} />
                <YAxis domain={[-10, 10]} stroke="#737373" fontSize={11} width={32} />
                <Tooltip contentStyle={{ background: "#1f1f1f", border: "1px solid #2c2c2c" }} formatter={(v: any) => [Number(v).toFixed(2), "eval"]} labelFormatter={(l) => `Posisi ${l}`} />
                <ReferenceLine y={0} stroke="#525252" />
                <ReferenceLine x={view} stroke="#10b981" />
                <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b981" fillOpacity={0.25} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {an && (
        <section className="grid gap-3 md:grid-cols-3">
          {[["CRITICAL MOMENTS", critical, "Tidak ada momen kritis besar."], ["BIGGEST MISTAKES", [...moveRows].filter((m) => ["blunder", "mistake"].includes(m.category)).sort((a, b) => b.winLoss - a.winLoss).slice(0, 3), "Tidak ada kesalahan besar."], ["BEST MOVES", bestMoves.slice(0, 5), "Belum ada Brilliant/Great."]].map(([title, list, empty]: any) => (
            <div key={title} className="card">
              <h2 className="h-sec">{title}</h2>
              {list.length === 0 ? <p className="text-sm text-neutral-500">{empty}</p> : (
                <ul className="space-y-1 text-sm">
                  {list.map((m: any) => (
                    <li key={m.i}><button className="hover:underline text-left" onClick={() => setView(m.i + 1)}>
                      <span style={{ color: META[m.category as Category].color }}>{META[m.category as Category].icon}</span>{" "}
                      {Math.floor(m.i / 2) + 1}{m.i % 2 ? "…" : "."} {sans[m.i]} <span className="text-neutral-500">({name(m.i % 2 ? "b" : "w")}{m.winLoss ? `, −${m.winLoss}%` : ""})</span></button></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
