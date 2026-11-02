import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
import { detectOpening } from "@/lib/openings";
import { UserError } from "@/lib/server/errors";

export const GET = handle(async () => {
  const data = must(await db().from("games")
    .select("id,mode,white_name,black_name,white_model,black_model,result,termination,pgn,opening,eco,num_moves,duration_ms,accuracy_white,accuracy_black,created_at")
    .order("created_at", { ascending: false }).limit(300));
  return json(data);
});

export const POST = handle(async (req: NextRequest) => {
  const b = await req.json();
  if (!b.white_name || !b.black_name || !b.pgn || !Array.isArray(b.moves) || !b.moves.length) throw new UserError("Data game tidak lengkap");
  const op = detectOpening(b.moves.map((m: any) => String(m.san)));
  const row = {
    mode: b.mode === "play" ? "play" : "ai_vs_ai",
    white_name: String(b.white_name).slice(0, 60), black_name: String(b.black_name).slice(0, 60),
    white_model: b.white_model ?? null, black_model: b.black_model ?? null,
    result: String(b.result ?? "*"), termination: b.termination ?? null,
    pgn: String(b.pgn), moves: b.moves, opening: op?.name ?? null, eco: op?.eco ?? null,
    num_moves: Math.ceil(b.moves.length / 2), duration_ms: Number(b.duration_ms) || null,
  };
  const data = must(await db().from("games").insert(row).select("id").single());
  return json(data, 201);
});
