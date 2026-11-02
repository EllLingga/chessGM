"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ProfilePublic, PROVIDERS, PROVIDER_LABEL, Provider } from "@/lib/types";
import { soundEnabled, setSoundEnabled, play } from "@/lib/sound";
import SetupBanner from "@/components/SetupBanner";

const MODELS: Record<Provider, string[]> = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: ["gpt-5", "gpt-4.1", "o4-mini"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  custom: [],
};
const empty = { name: "", provider: "anthropic" as Provider, model: "", api_key: "", base_url: "", temperature: "", max_tokens: "1024", thinking_budget: "", system_prompt: "", timeout_s: "60", max_retries: "3" };

export default function Settings() {
  const [list, setList] = useState<ProfilePublic[] | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<string, string>>({});
  const [sound, setSound] = useState(true);
  const [status, setStatus] = useState<any>(null);

  const load = () => api("/api/profiles").then(setList).catch((e) => { setList([]); setMsg({ ok: false, t: e.message }); });
  useEffect(() => { load(); setSound(soundEnabled()); fetch("/api/status").then((r) => r.json()).then(setStatus); }, []);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function edit(p: ProfilePublic) {
    setEditId(p.id);
    setForm({ name: p.name, provider: p.provider, model: p.model, api_key: "", base_url: p.base_url ?? "", temperature: p.temperature?.toString() ?? "", max_tokens: String(p.max_tokens), thinking_budget: p.thinking_budget?.toString() ?? "", system_prompt: p.system_prompt ?? "", timeout_s: String(p.timeout_s), max_retries: String(p.max_retries) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reset() { setEditId(null); setForm({ ...empty }); }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const body: any = { ...form };
      if (editId && !body.api_key) delete body.api_key;
      await api(editId ? `/api/profiles/${editId}` : "/api/profiles", { method: editId ? "PUT" : "POST", body: JSON.stringify(body) });
      setMsg({ ok: true, t: editId ? "Profil diperbarui." : "Profil tersimpan. API key dienkripsi di server." });
      reset(); load();
    } catch (e: any) { setMsg({ ok: false, t: e.message }); }
    setBusy(false);
  }
  async function del(p: ProfilePublic) {
    if (!confirm(`Hapus profil "${p.name}" beserta API key-nya?`)) return;
    try { await api(`/api/profiles/${p.id}`, { method: "DELETE" }); if (editId === p.id) reset(); load(); } catch (e: any) { setMsg({ ok: false, t: e.message }); }
  }
  async function test(p: ProfilePublic) {
    setTests((t) => ({ ...t, [p.id]: "Menguji…" }));
    try {
      const r = await api(`/api/profiles/${p.id}/test`, { method: "POST" });
      setTests((t) => ({ ...t, [p.id]: r.ok ? `✓ Terhubung (HTTP ${r.status}, ${(r.ms / 1000).toFixed(1)}s)` : `✗ ${r.status ? `HTTP ${r.status}: ` : ""}${r.error}` }));
    } catch (e: any) { setTests((t) => ({ ...t, [p.id]: `✗ ${e.message}` })); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SetupBanner />
      {status && !status.passwordSet && (
        <p className="rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200">
          APP_PASSWORD belum diset: siapa pun yang tahu URL website ini bisa memakai API key-mu. Sangat disarankan mengisinya di environment variables.
        </p>
      )}

      <section className="card space-y-4">
        <h2 className="h-sec !mb-0">{editId ? "EDIT PROFIL AI" : "TAMBAH PROFIL AI"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Nama profil (bebas, tampil di Arena)</label><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="mis. Claude Utama" maxLength={40} /></div>
          <div><label className="label">Provider</label>
            <select className="input" value={form.provider} onChange={(e) => set("provider", e.target.value)}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
            </select></div>
          <div><label className="label">Model</label>
            <input className="input" list="models" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="ketik atau pilih" />
            <datalist id="models">{MODELS[form.provider].map((m) => <option key={m} value={m} />)}</datalist></div>
          <div><label className="label">API key {editId && <span className="text-neutral-500">(kosongkan = tidak diubah)</span>}</label>
            <input className="input" type="password" autoComplete="off" value={form.api_key} onChange={(e) => set("api_key", e.target.value)} placeholder={editId ? "••••••••" : "tempel API key"} /></div>
          {form.provider === "custom" && (
            <div className="sm:col-span-2"><label className="label">Base URL (OpenAI-compatible, mis. https://openrouter.ai/api/v1)</label>
              <input className="input" value={form.base_url} onChange={(e) => set("base_url", e.target.value)} /></div>
          )}
          <div><label className="label">Temperature (kosong = default; diabaikan jika tidak didukung)</label><input className="input" type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(e) => set("temperature", e.target.value)} /></div>
          <div><label className="label">Maximum tokens</label><input className="input" type="number" value={form.max_tokens} onChange={(e) => set("max_tokens", e.target.value)} /></div>
          <div><label className="label">Thinking budget (kosong = nonaktif; Claude ≥1024)</label><input className="input" type="number" value={form.thinking_budget} onChange={(e) => set("thinking_budget", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Move timeout (detik)</label><input className="input" type="number" value={form.timeout_s} onChange={(e) => set("timeout_s", e.target.value)} /></div>
            <div><label className="label">Maximum retries</label><input className="input" type="number" value={form.max_retries} onChange={(e) => set("max_retries", e.target.value)} /></div>
          </div>
          <div className="sm:col-span-2"><label className="label">Custom system prompt (opsional, ditambahkan ke instruksi catur)</label>
            <textarea className="input min-h-[70px]" value={form.system_prompt} onChange={(e) => set("system_prompt", e.target.value)} /></div>
        </div>
        {msg && <p className={`text-sm ${msg.ok ? "text-accent" : "text-red-400"}`}>{msg.t}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : editId ? "Simpan perubahan" : "Simpan profil"}</button>
          {editId && <button className="btn" onClick={reset}>Batal</button>}
        </div>
        <p className="text-xs text-neutral-500">API key dikirim lewat HTTPS ke server, dienkripsi (AES-256-GCM) lalu disimpan di database. Key tidak pernah dikirim kembali ke browser; hanya 4 karakter terakhir yang ditampilkan.</p>
      </section>

      <section className="space-y-3">
        <h2 className="h-sec !mb-0">PROFIL TERSIMPAN</h2>
        {list === null && <p className="text-sm text-neutral-400">Memuat…</p>}
        {list?.length === 0 && <p className="text-sm text-neutral-400">Belum ada profil. Tambahkan minimal satu AI di atas.</p>}
        {list?.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-neutral-400">{PROVIDER_LABEL[p.provider]} · {p.model} · key {p.key_hint ?? "—"}</p>
              {tests[p.id] && <p className={`text-xs mt-1 ${tests[p.id].startsWith("✓") ? "text-accent" : tests[p.id].startsWith("✗") ? "text-red-400" : "text-neutral-400"}`}>{tests[p.id]}</p>}
            </div>
            <button className="btn" onClick={() => test(p)}>Test</button>
            <button className="btn" onClick={() => edit(p)}>Edit</button>
            <button className="btn-danger" onClick={() => del(p)}>Hapus</button>
          </div>
        ))}
      </section>

      <section className="card flex items-center justify-between">
        <div><p className="font-semibold">Efek suara</p><p className="text-xs text-neutral-400">Suara langkah, tangkapan, skak, skakmat.</p></div>
        <button className={sound ? "btn-primary" : "btn"} onClick={() => { const n = !sound; setSound(n); setSoundEnabled(n); if (n) play("move"); }}>{sound ? "Aktif" : "Nonaktif"}</button>
      </section>
    </div>
  );
}
