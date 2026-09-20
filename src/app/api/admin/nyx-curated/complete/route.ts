import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { completeCuratedDirectUpload } from "@/server/domain/nyx/curated/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  let body: { id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "Geen id." }, { status: 400 });

  try {
    const item = await completeCuratedDirectUpload(body.id);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Afronden mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
