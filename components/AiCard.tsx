"use client";
import { motion } from "framer-motion";
import { PROVIDER_LABEL, Provider } from "@/lib/types";

const COLORS: Record<string, string> = { gemini: "#4285f4", anthropic: "#d97757", openai: "#10a37f", deepseek: "#4d6bfe", custom: "#a3a3a3" };

export type AiCardProps = {
  color: "White" | "Black"; name: string; provider?: Provider; model?: string; status: string; thinking: boolean;
  moves: number; ms: number; inTok: number; outTok: number; http?: number; comment?: string; active?: boolean; elapsed?: number;
};

export default function AiCard(p: AiCardProps) {
  const c = COLORS[p.provider ?? "custom"];
  return (
    <motion.div animate={{ borderColor: p.active ? "#10b981" : "#2c2c2c" }} className="rounded-xl border bg-panel p-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-black shrink-0" style={{ background: c }}>
          {p.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] tracking-widest text-neutral-400">{p.color.toUpperCase()}</p>
          <p className="font-semibold truncate">{p.name}</p>
          <p className="text-xs text-neutral-400 truncate">{p.provider ? PROVIDER_LABEL[p.provider] : "—"} · {p.model ?? "—"}</p>
        </div>
        {p.thinking && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-neutral-400">Status</dt><dd className="truncate">{p.status}</dd>
        <dt className="text-neutral-400">Moves</dt><dd>{p.moves}</dd>
        <dt className="text-neutral-400">Time</dt><dd className="font-mono">{p.elapsed !== undefined ? `${p.elapsed.toFixed(1)}s` : p.ms ? `${(p.ms / 1000).toFixed(1)}s` : "—"}</dd>
        <dt className="text-neutral-400">Tokens</dt><dd className="font-mono">{p.inTok || p.outTok ? `${p.inTok} in / ${p.outTok} out` : "—"}</dd>
        <dt className="text-neutral-400">API</dt><dd className="font-mono">{p.http ? `HTTP ${p.http}` : "—"}</dd>
      </dl>
      {p.comment && <p className="mt-2 text-xs text-neutral-300 border-t border-line pt-2">“{p.comment}”</p>}
    </motion.div>
  );
}
