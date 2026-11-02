// Dipakai middleware (edge) & route auth — Web Crypto saja.
export async function authToken(): Promise<string> {
  const secret = process.env.ENCRYPTION_SECRET ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("grandmaster-auth:" + (process.env.APP_PASSWORD ?? "")));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
