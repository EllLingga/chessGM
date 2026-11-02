"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Login() {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr("");
    try { await api("/api/auth", { method: "POST", body: JSON.stringify({ password: pw }) }); window.location.href = "/"; }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <h1 className="text-center font-extrabold tracking-[0.2em] mb-8">GRAND<span className="text-accent">MASTER</span></h1>
      <div className="card space-y-3">
        <label className="label">Password</label>
        <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary w-full" onClick={submit} disabled={busy || !pw}>Masuk</button>
      </div>
    </div>
  );
}
