"use client";
import { Line, formatEval, lineToCp, winPct } from "@/lib/engine";

export default function EvalBar({ line, flipped }: { line?: Line; flipped?: boolean }) {
  const white = line ? winPct(lineToCp(line)) : 50;
  return (
    <div className="relative w-6 sm:w-7 rounded overflow-hidden bg-neutral-800 shrink-0 self-stretch">
      <div
        className="absolute left-0 right-0 transition-all duration-500 bg-neutral-100"
        style={flipped ? { top: 0, height: `${white}%` } : { bottom: 0, height: `${white}%` }}
      />
      <span className={`absolute left-0 right-0 text-[10px] font-semibold text-center ${flipped ? "bottom-1 text-neutral-900" : "top-1 text-neutral-300"}`}>
        {white < 50 ? formatEval(line) : ""}
      </span>
      <span className={`absolute left-0 right-0 text-[10px] font-semibold text-center ${flipped ? "top-1 text-neutral-300" : "bottom-1 text-neutral-900"}`}>
        {white >= 50 ? formatEval(line) : ""}
      </span>
    </div>
  );
}
