import crypto from "node:crypto";
import { ConfigError } from "./errors";

function key(): Buffer {
  const s = process.env.ENCRYPTION_SECRET;
  if (!s || s.length < 16) throw new ConfigError("ENCRYPTION_SECRET belum diset (minimal 16 karakter) di environment variables.");
  return crypto.createHash("sha256").update(s).digest();
}
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt(s: string): string {
  const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
