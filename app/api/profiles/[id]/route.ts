import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
import { encrypt } from "@/lib/server/crypto";
import { validateProfile, PUBLIC_COLS } from "@/lib/server/profile";

export const PUT = handle(async (req: NextRequest, { params }: any) => {
  const v = validateProfile(await req.json(), false);
  const patch: any = { ...v.fields };
  if (v.apiKey) { patch.api_key_enc = encrypt(v.apiKey); patch.key_hint = "…" + v.apiKey.slice(-4); }
  const res = await db().from("ai_profiles").update(patch).eq("id", params.id).select(PUBLIC_COLS).single();
  if (res.error?.message?.includes("duplicate")) return json({ error: "Nama sudah dipakai, pilih nama lain" }, 400);
  return json(must(res));
});

export const DELETE = handle(async (_req: NextRequest, { params }: any) => {
  must(await db().from("ai_profiles").delete().eq("id", params.id));
  return json({ ok: true });
});
