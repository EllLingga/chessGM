import { NextRequest } from "next/server";
import { handle, json, limited } from "@/lib/server/http";
import { db, must } from "@/lib/server/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
import { encrypt } from "@/lib/server/crypto";
import { validateProfile, PUBLIC_COLS } from "@/lib/server/profile";

export const GET = handle(async () => {
  const data = must(await db().from("ai_profiles").select(PUBLIC_COLS).order("created_at"));
  return json(data);
});

export const POST = handle(async (req: NextRequest) => {
  const v = validateProfile(await req.json(), true);
  const row = { ...v.fields, api_key_enc: encrypt(v.apiKey), key_hint: "…" + v.apiKey.slice(-4) };
  const res = await db().from("ai_profiles").insert(row).select(PUBLIC_COLS).single();
  if (res.error?.message?.includes("duplicate")) return json({ error: "Nama sudah dipakai, pilih nama lain" }, 400);
  return json(must(res), 201);
});
