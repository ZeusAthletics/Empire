import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("players").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, db: "live" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
