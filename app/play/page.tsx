"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chess, Square } from "chess.js";
import InteractiveBoard from "@/components/InteractiveBoard";
import AiCard from "@/components/AiCard";
import MoveList from "@/components/MoveList";
import SetupBanner from "@/components/SetupBanner";
import { api } from "@/lib/api";
import { getAiMove } from "@/lib/aiClient";
import { play as sfx, soundForMove } from "@/lib/sound";
import type { ProfilePublic } from "@/lib/types";

const LEVELS = ["beginner", "intermediate", "advanced", "expert", "grandmaster"];
const START = new Chess().fen();

export default function Play() {
  const [profiles, setProfiles] = useState<ProfilePublic[] | null>(null);
  const [profileId, setProfileId] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [colorPref, setColorPref] = useState<"white" | "black" | "random">("white");
  const [started, setStarted] = useState(false);
  const [human, setHuman] = useState<"w" | "b">("w");
  const [fen, setFen] = useState(START);
  const [sans, setSans] = useState<string[]>([]);
  const [lastUci, setLastUci] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [ai, setAi] = useState({ status: "Waiting for turn", ms: 0, inTok: 0, outTok: 0, http: undefined as number | undefined, moves: 0, comment: "" as string | undefined });
  const gameRef = useRef(new Chess()); const recs = useRef<any[]>([]); const startedAt = useRef(0); const abortRef = useRef<AbortController | null>(null);
  const over = useRef(false);

  useEffect(() => {
    api("/api/profiles").then((l: ProfilePublic[]) => { setProfiles(l); setProfileId(l[0]?.id ?? ""); }).catch(() => setProfiles([]));
    return () => abortRef.current?.abort();
  }, []);
  const prof = profiles?.find((p) => p.id === profileId);

  async function end(res: string, term: string, humanColor: "w" | "b") {
    over.current = true; setResult(`${res} · ${term}`); sfx(term === "checkmate" ? "mate" : "end");
    const g = gameRef.current;
    g.setHeader("Event", "GRANDMASTER Play"); g.setHeader("White", humanColor === "w" ? "You" : prof!.name); g.setHeader("Black", humanColor === "b" ? "You" : prof!.name); g.setHeader("Result", res);
    try {
      const r = await api("/api/games", { method: "POST", body: JSON.stringify({
        mode: "play", white_name: humanColor === "w" ? "You" : prof!.name, black_name: humanColor === "b" ? "You" : prof!.name,
        white_model: humanColor === "w" ? null : prof!.model, black_model: humanColor === "b" ? null : prof!.model,
        result: res, termination: term, pgn: g.pgn(), moves: recs.current, duration_ms: Date.now() - startedAt.current }) });
      setSavedId(r.id);
    } catch {}
  }
  function checkEnd(humanColor: "w" | "b"): boolean {
    const g = gameRef.current;
    if (!g.isGameOver()) return false;
    if (g.isCheckmate()) end(g.turn() === "w" ? "0-1" : "1-0", "checkmate", humanColor);
    else end("1/2-1/2", g.isStalemate() ? "stalemate" : g.isThreefoldRepetition() ? "threefold repetition" : g.isInsufficientMaterial() ? "insufficient material" : "50-move rule", humanColor);
    return true;
  }

  async function aiMove(humanColor: "w" | "b") {
    if (!prof || over.current) return;
    const g = gameRef.current; const ac = new AbortController(); abortRef.current = ac;
    setBusy(true); setError(""); setAi((a) => ({ ...a, status: "Thinking…", http: undefined }));
    try {
      const r = await getAiMove({ profileId: prof.id, game: g, maxRetries: prof.max_retries, difficulty: level, signal: ac.signal, onStatus: (s) => setAi((a) => ({ ...a, status: s.message, http: s.httpStatus })) });
      const m = g.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
      recs.current.push({ san: m.san, uci: r.uci, ms: r.ms, comment: r.comment, confidence: r.confidence });
      setFen(g.fen()); setSans(g.history()); setLastUci(r.uci); sfx(soundForMove(g, m));
      setAi((a) => ({ status: "Waiting for turn", ms: r.ms, inTok: a.inTok + r.inTokens, outTok: a.outTok + r.outTokens, http: r.http, moves: a.moves + 1, comment: r.comment }));
      checkEnd(humanColor);
    } catch (e: any) {
      if (e?.name !== "AbortError") { setError(e.message); setAi((a) => ({ ...a, status: "AI error" })); }
    }
    setBusy(false);
  }

  function start() {
    const hc: "w" | "b" = colorPref === "random" ? (Math.random() < 0.5 ? "w" : "b") : colorPref === "white" ? "w" : "b";
    abortRef.current?.abort();
    gameRef.current = new Chess(); recs.current = []; over.current = false; startedAt.current = Date.now();
    setHuman(hc); setFen(START); setSans([]); setLastUci(null); setResult(""); setError(""); setSavedId(null); setStarted(true);
    setAi({ status: "Waiting for turn", ms: 0, inTok: 0, outTok: 0, http: undefined, moves: 0, comment: undefined });
    sfx("start");
    if (hc === "b") aiMove(hc);
  }

  function onMove(from: Square, to: Square, promotion?: string) {
    const g = gameRef.current;
    if (busy || over.current || g.turn() !== human) return;
    const m = g.move({ from, to, promotion });
    recs.current.push({ san: m.san, uci: from + to + (m.promotion ?? "") });
    setFen(g.fen()); setSans(g.history()); setLastUci(from + to + (m.promotion ?? "")); sfx(soundForMove(g, m));
    if (!checkEnd(human)) aiMove(human);
  }
  function resign() {
    if (over.current) return; abortRef.current?.abort(); setBusy(false);
    end(human === "w" ? "0-1" : "1-0", "resignation", human);
  }

  if (profiles && profiles.length === 0)
    return (
      <div className="mx-auto max-w-xl px-4 py-16 space-y-4"><SetupBanner />
        <div className="card text-center space-y-3"><h1 className="text-xl font-bold">Belum ada AI yang dikonfigurasi</h1>
          <p className="text-sm text-neutral-400">Tambahkan API key AI dan beri nama di Settings.</p>
          <Link href="/settings" className="btn-primary inline-block">Buka Settings</Link></div></div>
    );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
      <div className="space-y-3 lg:order-1">
        <section className="card space-y-3">
          <h2 className="h-sec !mb-0">GAME SETUP</h2>
          <div><label className="label">Lawan (AI)</label>
            <select className="input" value={profileId} disabled={started && !result} onChange={(e) => setProfileId(e.target.value)}>
              {profiles?.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.model}</option>)}</select></div>
          <div><label className="label">Tingkat kesulitan</label>
            <select className="input" value={level} disabled={started && !result} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}</select></div>
          <div><label className="label">Warna kamu</label>
            <select className="input" value={colorPref} disabled={started && !result} onChange={(e) => setColorPref(e.target.value as any)}>
              <option value="white">White</option><option value="black">Black</option><option value="random">Random</option></select></div>
          <button className="btn-primary w-full" onClick={start} disabled={!profileId}>{started ? "Game Baru" : "Mulai Main"}</button>
        </section>
        {started && prof && <AiCard color={human === "w" ? "Black" : "White"} name={prof.name} provider={prof.provider} model={prof.model} status={ai.status} thinking={busy} moves={ai.moves} ms={ai.ms} inTok={ai.inTok} outTok={ai.outTok} http={ai.http} comment={ai.comment} active={busy} />}
      </div>
      <div className="min-w-0 lg:order-2">
        <InteractiveBoard id="play" fen={fen} orientation={human === "w" ? "white" : "black"} enabled={started && !busy && !result && gameRef.current.turn() === human} onMove={onMove} lastMove={lastUci} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-danger" onClick={resign} disabled={!started || !!result}>Resign</button>
          {started && !result && <span className="text-sm text-neutral-400">{busy ? "AI sedang berpikir…" : gameRef.current.turn() === human ? "Giliran kamu" : ""}</span>}
          {result && <span className="text-accent font-semibold">{result}</span>}
        </div>
        {error && (
          <div className="mt-2 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300 space-y-2">
            <p>{error}</p><button className="btn" onClick={() => aiMove(human)}>Coba lagi</button></div>
        )}
        {savedId && <Link href={`/review/${savedId}`} className="btn-primary inline-block mt-3">Game Review →</Link>}
      </div>
      <section className="card !p-2 max-h-[420px] overflow-auto lg:order-3">
        <h2 className="h-sec px-2 pt-1 !mb-2">MOVES</h2>
        <MoveList sans={sans} view={sans.length} onSelect={() => {}} />
      </section>
    </div>
  );
}
