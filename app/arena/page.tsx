"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import InteractiveBoard from "@/components/InteractiveBoard";
import EvalBar from "@/components/EvalBar";
import AiCard from "@/components/AiCard";
import MoveList from "@/components/MoveList";
import SetupBanner from "@/components/SetupBanner";
import { api } from "@/lib/api";
import { getAiMove } from "@/lib/aiClient";
import { Engine, analyzeFen, Line } from "@/lib/engine";
import { play as sfx, soundForMove } from "@/lib/sound";
import type { ProfilePublic, MoveRec } from "@/lib/types";

type Status = "idle" | "running" | "paused" | "finished" | "stopped" | "error";
type Side = { status: string; since: number | null; ms: number; inTok: number; outTok: number; http?: number; moves: number; comment?: string };
type Rec = MoveRec & { fen: string };
const blank = (): Side => ({ status: "Waiting for turn", since: null, ms: 0, inTok: 0, outTok: 0, moves: 0 });
const START = new Chess().fen();

export default function Arena() {
  const [profiles, setProfiles] = useState<ProfilePublic[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [whiteId, setWhiteId] = useState(""); const [blackId, setBlackId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [fen, setFen] = useState(START);
  const [moves, setMoves] = useState<Rec[]>([]);
  const [view, setView] = useState<number | null>(null);
  const [sides, setSides] = useState<{ w: Side; b: Side }>({ w: blank(), b: blank() });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ result: string; termination: string } | null>(null);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [live, setLive] = useState<Line | undefined>();
  const [now, setNow] = useState(Date.now());

  const gameRef = useRef(new Chess()); const runId = useRef(0); const loopFor = useRef(0);
  const pauseRef = useRef(false); const stepRef = useRef(false); const abortRef = useRef<AbortController | null>(null);
  const engineRef = useRef<Engine | null>(null); const startedAt = useRef(0);
  const movesRef = useRef<Rec[]>([]); const profRef = useRef<{ w: ProfilePublic; b: ProfilePublic } | null>(null);

  useEffect(() => {
    api("/api/profiles").then((l: ProfilePublic[]) => { setProfiles(l); setWhiteId(l[0]?.id ?? ""); setBlackId(l[1]?.id ?? l[0]?.id ?? ""); })
      .catch((e) => { setProfiles([]); setLoadErr(e.message); });
    try { engineRef.current = new Engine(); } catch {}
    return () => { runId.current++; abortRef.current?.abort(); engineRef.current?.terminate(); };
  }, []);
  useEffect(() => { if (status !== "running") return; const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, [status]);

  const upd = (s: "w" | "b", patch: Partial<Side>) => setSides((p) => ({ ...p, [s]: { ...p[s], ...patch } }));
  const evalLive = (f: string) => { engineRef.current && analyzeFen(engineRef.current, f, 10, 1).then((a) => { if (gameRef.current.fen() === f) setLive(a.lines[0]); }).catch(() => {}); };

  async function save(termination: string, res: string) {
    const g = gameRef.current, p = profRef.current;
    if (!p || !movesRef.current.length) return;
    g.setHeader("Event", "GRANDMASTER AI Arena"); g.setHeader("White", p.w.name); g.setHeader("Black", p.b.name);
    g.setHeader("Result", res); g.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
    try {
      const r = await api("/api/games", { method: "POST", body: JSON.stringify({
        mode: "ai_vs_ai", white_name: p.w.name, black_name: p.b.name, white_model: p.w.model, black_model: p.b.model,
        result: res, termination, pgn: g.pgn(), moves: movesRef.current.map(({ fen: _f, ...m }) => m), duration_ms: Date.now() - startedAt.current,
      }) });
      setSavedId(r.id);
    } catch (e: any) { setError((prev) => prev || "Gagal menyimpan game: " + e.message); }
  }

  async function finish(id: number) {
    if (runId.current !== id) return;
    const g = gameRef.current;
    let res = "1/2-1/2", term = "draw";
    if (g.isCheckmate()) { res = g.turn() === "w" ? "0-1" : "1-0"; term = "checkmate"; }
    else if (g.isStalemate()) term = "stalemate";
    else if (g.isThreefoldRepetition()) term = "threefold repetition";
    else if (g.isInsufficientMaterial()) term = "insufficient material";
    else term = "50-move rule";
    setResult({ result: res, termination: term }); setStatus("finished");
    upd("w", { status: "Game over", since: null }); upd("b", { status: "Game over", since: null });
    sfx(g.isCheckmate() ? "mate" : "end");
    await save(term, res);
  }

  async function playOne(id: number): Promise<boolean> {
    const g = gameRef.current, side = g.turn() as "w" | "b", other = side === "w" ? "b" : "w";
    const prof = profRef.current![side];
    const ac = new AbortController(); abortRef.current = ac;
    setBusy(true);
    upd(side, { status: "Thinking…", since: Date.now(), http: undefined }); upd(other, { status: "Waiting for turn", since: null });
    try {
      const r = await getAiMove({
        profileId: prof.id, game: g, maxRetries: prof.max_retries, signal: ac.signal,
        onStatus: (s) => { if (runId.current === id) upd(side, { status: s.message, http: s.httpStatus }); },
      });
      if (runId.current !== id) return false;
      const m = g.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
      const rec: Rec = { san: m.san, uci: r.uci, ms: r.ms, comment: r.comment, confidence: r.confidence, tokens: r.inTokens + r.outTokens, fen: g.fen() };
      movesRef.current = [...movesRef.current, rec]; setMoves(movesRef.current); setFen(g.fen());
      sfx(soundForMove(g, m));
      setSides((p) => ({ ...p, [side]: { ...p[side], status: "Move played", since: null, ms: r.ms, inTok: p[side].inTok + r.inTokens, outTok: p[side].outTok + r.outTokens, http: r.http, moves: p[side].moves + 1, comment: r.comment } }));
      evalLive(g.fen());
      return true;
    } catch (e: any) {
      if (runId.current !== id || e?.name === "AbortError") return false;
      upd(side, { status: "AI error", since: null });
      setError(`${prof.name} (${side === "w" ? "White" : "Black"}): ${e.message}`); setStatus("error");
      const res = "*"; setResult({ result: res, termination: "ai_error" }); sfx("end");
      await save("ai_error", res);
      return false;
    } finally { if (runId.current === id) setBusy(false); }
  }

  async function loop(id: number) {
    if (loopFor.current === id) return;
    loopFor.current = id;
    try {
      while (runId.current === id) {
        if (gameRef.current.isGameOver()) { await finish(id); return; }
        if (pauseRef.current && !stepRef.current) return;
        const single = stepRef.current; stepRef.current = false;
        const ok = await playOne(id);
        if (!ok) return;
        if (single) { if (gameRef.current.isGameOver()) await finish(id); return; }
      }
    } finally { if (loopFor.current === id) loopFor.current = 0; }
  }

  function start() {
    const w = profiles?.find((p) => p.id === whiteId), b = profiles?.find((p) => p.id === blackId);
    if (!w || !b) return;
    abortRef.current?.abort();
    const id = ++runId.current;
    profRef.current = { w, b };
    gameRef.current = new Chess(); movesRef.current = [];
    pauseRef.current = false; stepRef.current = false; startedAt.current = Date.now();
    setMoves([]); setFen(START); setResult(null); setError(""); setSavedId(null); setView(null); setLive(undefined); setBusy(false);
    setSides({ w: blank(), b: blank() }); setStatus("running"); sfx("start");
    loop(id);
  }
  function pause() { pauseRef.current = true; setStatus("paused"); }
  function resume() { pauseRef.current = false; setStatus("running"); loop(runId.current); }
  function next() { stepRef.current = true; loop(runId.current); }
  function stop() {
    runId.current++; abortRef.current?.abort(); pauseRef.current = false; setBusy(false);
    setStatus("stopped"); setResult({ result: "*", termination: "stopped" });
    upd("w", { status: "Stopped", since: null }); upd("b", { status: "Stopped", since: null });
    save("stopped", "*");
  }

  const active = status === "running" || status === "paused";
  const pw = profiles?.find((p) => p.id === (profRef.current?.w.id ?? whiteId)), pb = profiles?.find((p) => p.id === (profRef.current?.b.id ?? blackId));
  const turn = gameRef.current.turn();
  const shownFen = view === null ? fen : view === 0 ? START : moves[view - 1]?.fen ?? fen;
  const lastUci = view === null ? moves[moves.length - 1]?.uci : view > 0 ? moves[view - 1]?.uci : undefined;
  const swap = () => { setWhiteId(blackId); setBlackId(whiteId); };
  const card = (c: "w" | "b") => {
    const p = c === "w" ? pw : pb, s = sides[c];
    const thinking = status === "running" && busy && turn === c;
    return (
      <AiCard key={c} color={c === "w" ? "White" : "Black"} name={p?.name ?? "—"} provider={p?.provider} model={p?.model} status={s.status}
        thinking={thinking} moves={s.moves} ms={s.ms} inTok={s.inTok} outTok={s.outTok} http={s.http} comment={s.comment}
        active={thinking} elapsed={s.since ? (now - s.since) / 1000 : undefined} />
    );
  };
  const resultText = result ? (result.result === "*" ? `Dihentikan — ${result.termination === "ai_error" ? "AI error" : result.termination}` : `${result.result} · ${result.termination}`) : "";

  if (profiles && profiles.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 space-y-4">
        <SetupBanner />
        <div className="card text-center space-y-3">
          <h1 className="text-xl font-bold">Belum ada AI yang dikonfigurasi</h1>
          <p className="text-sm text-neutral-400">{loadErr || "Tambahkan API key AI (Gemini, Claude, OpenAI, DeepSeek, atau Custom) dan beri nama sendiri di Settings."}</p>
          <Link href="/settings" className="btn-primary inline-block">Buka Settings</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <div className="space-y-3 lg:order-1">
        <section className="card space-y-3">
          <h2 className="h-sec !mb-0">MATCH SETUP</h2>
          <div><label className="label">WHITE (AI 1)</label>
            <select className="input" disabled={active} value={whiteId} onChange={(e) => setWhiteId(e.target.value)}>
              {profiles?.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.model}</option>)}</select></div>
          <button className="btn w-full" disabled={active} onClick={swap}>⇅ Tukar warna</button>
          <div><label className="label">BLACK (AI 2)</label>
            <select className="input" disabled={active} value={blackId} onChange={(e) => setBlackId(e.target.value)}>
              {profiles?.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.model}</option>)}</select></div>
        </section>
        {card("b")}{card("w")}
      </div>

      <div className="lg:order-2 min-w-0">
        <div className="flex gap-2">
          <EvalBar line={live} flipped={flipped} />
          <div className="flex-1 min-w-0">
            <InteractiveBoard id="arena" fen={shownFen} orientation={flipped ? "black" : "white"} lastMove={lastUci} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!active ? <button className="btn-primary" onClick={start} disabled={!whiteId || !blackId}>START BATTLE</button>
            : status === "paused" ? <button className="btn-primary" onClick={resume}>RESUME</button>
            : <button className="btn" onClick={pause}>PAUSE</button>}
          <button className="btn" onClick={next} disabled={status !== "paused" || busy}>NEXT MOVE</button>
          <button className="btn-danger" onClick={stop} disabled={!active}>STOP MATCH</button>
          <button className="btn" onClick={start} disabled={status === "idle"}>RESTART</button>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>Flip</button>
        </div>
        <p className="mt-2 text-sm text-neutral-400">
          Status: <span className="text-white font-semibold">{status.toUpperCase()}</span>{resultText && <> · <span className="text-accent font-semibold">{resultText}</span></>}
        </p>
        {error && <p className="mt-2 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
        {savedId && <Link href={`/review/${savedId}`} className="btn-primary inline-block mt-3">Buka Game Review →</Link>}
      </div>

      <div className="space-y-3 lg:order-3">
        <section className="card !p-2 max-h-[420px] overflow-auto">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <h2 className="h-sec !mb-0">MOVE HISTORY</h2>
            {view !== null && <button className="text-xs text-accent" onClick={() => setView(null)}>● Live</button>}
          </div>
          <MoveList sans={moves.map((m) => m.san)} view={view ?? moves.length} onSelect={(n) => setView(n === moves.length ? null : n)} />
        </section>
        <section className="card text-xs text-neutral-400">
          <p>Setiap langkah divalidasi chess.js di server. Langkah ilegal → AI diberi feedback dan diminta ulang (maks. sesuai “Maximum retries” profilnya). Jika tetap gagal, pertandingan berhenti dengan status AI error.</p>
        </section>
      </div>
    </div>
  );
}
