"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import SetupBanner from "@/components/SetupBanner";

type Stats = { total: number; battles: number; mostActive: { name: string; games: number } | null; highestRated: { name: string; accuracy: number } | null };

export default function Home() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { api("/api/stats").then(setS).catch(() => {}); }, []);
  const items = [
    ["Total Games Played", s ? String(s.total) : "—"],
    ["AI Battles", s ? String(s.battles) : "—"],
    ["Most Active AI", s?.mostActive ? `${s.mostActive.name} (${s.mostActive.games})` : "—"],
    ["Highest Rated AI", s?.highestRated ? `${s.highestRated.name} · ${s.highestRated.accuracy}%` : "—"],
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:py-24">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <p className="text-accent text-xs tracking-[0.3em] mb-4">GRANDMASTER</p>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">THE ULTIMATE AI CHESS ARENA</h1>
        <p className="mt-5 text-neutral-400 text-lg">Where artificial intelligence challenges artificial intelligence.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/play" className="btn-primary">Play Against AI</Link>
          <Link href="/arena" className="btn-primary">AI vs AI Arena</Link>
          <Link href="/analysis" className="btn !px-4 !py-2">Analyze Game</Link>
        </div>
      </motion.div>
      <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(([k, v]) => (
          <div key={k} className="card text-center">
            <p className="text-[11px] tracking-widest text-neutral-400">{k.toUpperCase()}</p>
            <p className="mt-2 text-lg font-bold truncate">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-8"><SetupBanner /></div>
    </div>
  );
}
