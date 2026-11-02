import { db, must } from "./db";
import { decrypt } from "./crypto";
import { UserError } from "./errors";
import { PROVIDERS } from "../types";

export const PUBLIC_COLS =
  "id,name,provider,model,base_url,temperature,max_tokens,thinking_budget,system_prompt,timeout_s,max_retries,key_hint,created_at";

function numOrNull(v: any, min: number, max: number, label: string): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new UserError(`${label} harus ${min}–${max}`);
  return n;
}

export function validateProfile(b: any, create: boolean) {
  const f: any = {};
  const need = (c: boolean, m: string) => { if (!c) throw new UserError(m); };
  if (create || b.name !== undefined) { const n = String(b.name ?? "").trim(); need(n.length >= 1 && n.length <= 40, "Nama harus 1–40 karakter"); f.name = n; }
  if (create || b.provider !== undefined) { need(PROVIDERS.includes(b.provider), "Provider tidak valid"); f.provider = b.provider; }
  if (create || b.model !== undefined) { const m = String(b.model ?? "").trim(); need(m.length > 0 && m.length <= 100, "Model wajib diisi"); f.model = m; }
  if (b.base_url !== undefined) {
    const u = String(b.base_url || "").trim();
    if (u) {
      let p: URL;
      try { p = new URL(u); } catch { throw new UserError("Base URL tidak valid"); }
      need(/^https?:$/.test(p.protocol), "Base URL harus diawali http(s)://");
      f.base_url = u.replace(/\/+$/, "");
    } else f.base_url = null;
  }
  if (create && b.provider === "custom") need(!!f.base_url, "Base URL wajib untuk provider Custom");
  if (b.temperature !== undefined) f.temperature = numOrNull(b.temperature, 0, 2, "Temperature");
  if (b.max_tokens !== undefined) f.max_tokens = numOrNull(b.max_tokens, 16, 64000, "Max tokens") ?? 1024;
  if (b.thinking_budget !== undefined) f.thinking_budget = numOrNull(b.thinking_budget, 0, 64000, "Thinking budget");
  if (b.system_prompt !== undefined) f.system_prompt = String(b.system_prompt || "").slice(0, 4000) || null;
  if (b.timeout_s !== undefined) f.timeout_s = numOrNull(b.timeout_s, 5, 300, "Timeout") ?? 60;
  if (b.max_retries !== undefined) f.max_retries = numOrNull(b.max_retries, 0, 10, "Max retries") ?? 3;
  const apiKey = b.api_key ? String(b.api_key).trim() : "";
  if (create) need(apiKey.length >= 8, "API key wajib diisi");
  return { fields: f, apiKey };
}

export async function loadProfile(id: string) {
  const row: any = must(await db().from("ai_profiles").select("*").eq("id", id).maybeSingle());
  if (!row) throw new UserError("Profil AI tidak ditemukan");
  return { ...row, apiKey: row.api_key_enc ? decrypt(row.api_key_enc) : "" };
}
