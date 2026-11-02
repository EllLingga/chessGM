import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    db: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    encryption: (process.env.ENCRYPTION_SECRET ?? "").length >= 16,
    passwordSet: !!process.env.APP_PASSWORD,
  });
}
