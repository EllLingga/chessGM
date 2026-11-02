import { NextRequest, NextResponse } from "next/server";
import { ConfigError, UserError } from "./errors";

export const json = (data: any, status = 200) => NextResponse.json(data, { status });

export function handle(fn: (req: NextRequest, ctx: any) => Promise<Response>) {
  return async (req: NextRequest, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e: any) {
      if (e instanceof ConfigError) return json({ error: e.message, config: true }, 503);
      if (e instanceof UserError) return json({ error: e.message }, 400);
      console.error("[api]", String(e?.message ?? e).replace(/(sk-[\w-]+|AIza[\w-]+)/g, "***"));
      return json({ error: e?.message ?? "Server error" }, 500);
    }
  };
}

const hits = new Map<string, number[]>();
/** Rate limit sederhana per IP (best-effort pada serverless). true = melebihi batas. */
export function limited(req: NextRequest, name: string, max: number, windowMs: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const k = `${name}:${ip}`, now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}
