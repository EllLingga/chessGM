"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SetupBanner() {
  const [s, setS] = useState<{ db: boolean; encryption: boolean; passwordSet: boolean } | null>(null);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s || (s.db && s.encryption)) return null;
  return (
    <div className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-4 text-sm">
      <p className="font-semibold text-amber-300">Setup belum lengkap</p>
      <ul className="mt-2 list-disc pl-5 text-amber-100/90 space-y-1">
        {!s.db && <li>Database belum terhubung: isi <code>SUPABASE_URL</code> dan <code>SUPABASE_SERVICE_ROLE_KEY</code>, lalu jalankan <code>supabase/schema.sql</code>.</li>}
        {!s.encryption && <li>Isi <code>ENCRYPTION_SECRET</code> (min. 16 karakter acak) untuk mengenkripsi API key.</li>}
      </ul>
      <p className="mt-2 text-amber-100/70">Setelah env var diisi di Vercel, lakukan Redeploy. Lihat README. <Link className="underline" href="/settings">Settings</Link></p>
    </div>
  );
}
