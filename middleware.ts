import { NextRequest, NextResponse } from "next/server";
import { authToken } from "@/lib/server/token";

export async function middleware(req: NextRequest) {
  if (!process.env.APP_PASSWORD) return NextResponse.next();
  const p = req.nextUrl.pathname;
  if (p === "/login" || p === "/api/auth" || p === "/api/status") return NextResponse.next();
  const c = req.cookies.get("gm_auth")?.value;
  if (c && c === (await authToken())) return NextResponse.next();
  if (p.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|stockfish/).*)"] };
