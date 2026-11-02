import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
import { UserError } from "@/lib/server/errors";

export const GET = handle(async (_req: NextRequest, { params }: any) => {
  const g = must(await db().from("games").select("*").eq("id", params.id).maybeSingle());
  if (!g) return json({ error: "Game tidak ditemukan" }, 404);
  return json(g);
});

export const PUT = handle(async (req: NextRequest, { params }: any) => {
  const b = await req.json();
  if (!b.analysis) throw new UserError("analysis wajib");
  must(await db().from("games").update({
    analysis: b.analysis, accuracy_white: b.accuracy_white ?? null, accuracy_black: b.accuracy_black ?? null,
  }).eq("id", params.id));
  return json({ ok: true });
});

export const DELETE = handle(async (_req: NextRequest, { params }: any) => {
  must(await db().from("games").delete().eq("id", params.id));
  return json({ ok: true });
});
