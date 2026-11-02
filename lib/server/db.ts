import { createClient } from "@supabase/supabase-js";
import { ConfigError } from "./errors";

let client: any;
export function db(): any {
  if (client) return client;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ConfigError("Database belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (lihat README).");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
export function must<T>(res: { data: T; error: any }): T {
  if (res.error) {
    const m = String(res.error.message || res.error);
    if (/relation .* does not exist|schema cache/i.test(m)) throw new ConfigError("Tabel belum dibuat. Jalankan supabase/schema.sql di Supabase SQL Editor.");
    throw new Error(m);
  }
  return res.data;
}
