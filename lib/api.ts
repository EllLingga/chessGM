export async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  if (r.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e: any = new Error(j.error || `HTTP ${r.status}`);
    e.config = !!j.config;
    throw e;
  }
  return j;
}
