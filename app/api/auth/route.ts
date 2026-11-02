import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authToken } from "@/lib/server/token";
import { limited } from "@/lib/server/http";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.json({ ok: true });
  if (limited(req, "auth", 10, 60_000)) return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const a = Buffer.from(String(body.password ?? "")), b = Buffer.from(pw);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: "Password salah" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("gm_auth", await authToken(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
