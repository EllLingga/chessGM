import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
// Statistik dihitung dari game yang tersimpan di database GRANDMASTER (bukan data karangan).
export const POST = handle(async (req: NextRequest) => {
  const prefix: string[] = ((await req.json()).moves ?? []).map(String);
  const rows: any[] = must(await db().from("games").select("moves,result").limit(5000)) ?? [];
  const tot = { total: 0, white: 0, draws: 0, black: 0 };
  const next: Record<string, any> = {};
  const add = (o: any, r: string) => { o.total++; if (r === "1-0") o.white++; else if (r === "0-1") o.black++; else if (r === "1/2-1/2") o.draws++; };
  for (const g of rows) {
    const sans: string[] = (g.moves ?? []).map((m: any) => m.san);
    if (sans.length < prefix.length || !prefix.every((m, i) => sans[i] === m)) continue;
    add(tot, g.result);
    const n = sans[prefix.length];
    if (n) add((next[n] ??= { san: n, total: 0, white: 0, draws: 0, black: 0 }), g.result);
  }
  return json({ ...tot, next: Object.values(next).sort((a: any, b: any) => b.total - a.total).slice(0, 12) });
});
