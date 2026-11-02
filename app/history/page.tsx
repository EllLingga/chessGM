"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import SetupBanner from "@/components/SetupBanner";

export default function History() {
  const [games, setGames] = useState<any[] | null>(null);
  const [q, setQ] = useState(""); const [err, setErr] = useState("");
  const load = () => api("/api/games").then(setGames).catch((e) => { setGames([]); setErr(e.message); });
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (games ?? []).filter((g) => !s || [g.white_name, g.black_name, g.opening, g.eco, g.result, g.white_model, g.black_model].some((x) => String(x ?? "").toLowerCase().includes(s)));
  }, [games, q]);

  function exportPgn(g: any) {
    const blob = new Blob([g.pgn], { type: "application/x-chess-pgn" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${g.white_name}-vs-${g.black_name}.pgn`; a.click(); URL.revokeObjectURL(a.href);
  }
  async function del(g: any) {
    if (!confirm(`Hapus game ${g.white_name} vs ${g.black_name}?`)) return;
    try { await api(`/api/games/${g.id}`, { method: "DELETE" }); setGames((p) => (p ?? []).filter((x) => x.id !== g.id)); } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-2xl font-bold">Game History</h1>
        <input className="input !w-full sm:!w-72" placeholder="Cari pemain, pembukaan, hasil…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <SetupBanner />
      {err && <p className="text-sm text-red-400">{err}</p>}
      {games === null && <p className="text-sm text-neutral-400">Memuat…</p>}
      {games && list.length === 0 && !err && <p className="text-sm text-neutral-400">{games.length ? "Tidak ada hasil." : "Belum ada game tersimpan. Mainkan pertandingan di AI Arena atau Play."}</p>}
      <div className="space-y-3">
        {list.map((g) => (
          <div key={g.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{g.white_name} <span className="text-neutral-500">vs</span> {g.black_name}</p>
              <p className="text-accent font-semibold">{g.result}</p>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {new Date(g.created_at).toLocaleString()} · {g.num_moves} langkah · {g.opening ? `${g.eco} ${g.opening}` : "Opening —"} · {g.termination ?? ""}
              {g.accuracy_white != null && <> · Accuracy {g.accuracy_white.toFixed(1)}% / {g.accuracy_black.toFixed(1)}%</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn" href={`/review/${g.id}`}>Replay</Link>
              <Link className="btn" href={`/review/${g.id}`}>{g.accuracy_white != null ? "Game Review" : "Analyze"}</Link>
              <button className="btn" onClick={() => exportPgn(g)}>Export PGN</button>
              <button className="btn-danger" onClick={() => del(g)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
