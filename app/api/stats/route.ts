import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const rows: any[] = must(await db().from("games").select("mode,white_name,black_name,accuracy_white,accuracy_black").limit(5000)) ?? [];
  const HUMAN = "You";
  const act: Record<string, number> = {}, acc: Record<string, number[]> = {};
  for (const r of rows) {
    for (const [n, a] of [[r.white_name, r.accuracy_white], [r.black_name, r.accuracy_black]] as const) {
      if (n === HUMAN) continue;
      act[n] = (act[n] ?? 0) + 1;
      if (a != null) (acc[n] ??= []).push(a);
    }
  }
  const most = Object.entries(act).sort((a, b) => b[1] - a[1])[0];
  const top = Object.entries(acc).map(([n, v]) => [n, v.reduce((s, x) => s + x, 0) / v.length] as const).sort((a, b) => b[1] - a[1])[0];
  return json({
    total: rows.length,
    battles: rows.filter((r) => r.mode === "ai_vs_ai").length,
    mostActive: most ? { name: most[0], games: most[1] } : null,
    highestRated: top ? { name: top[0], accuracy: Math.round(top[1] * 10) / 10 } : null,
  });
});
