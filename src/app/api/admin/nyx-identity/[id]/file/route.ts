import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/server/auth/session";
import { MEDIA_BUCKET } from "@/server/domain/media/repository";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const { id } = await context.params;
  const client = createSupabaseAdminClient();
  const { data: row, error } = await client.from("nyx_identity_refs").select("storage_path").eq("id", id).maybeSingle();
  if (error || !row?.storage_path) {
    return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
  }

  const { data: file, error: dlError } = await client.storage.from(MEDIA_BUCKET).download(row.storage_path as string);
  if (dlError || !file) {
    return NextResponse.json({ ok: false, error: "Bestand ontbreekt." }, { status: 404 });
  }

  const path = String(row.storage_path);
  const type = /\.png$/i.test(path) ? "image/png" : /\.webp$/i.test(path) ? "image/webp" : "image/jpeg";
  const bytes = await file.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
