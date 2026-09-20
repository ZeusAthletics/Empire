import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import {
  deleteCuratedMedia,
  listCuratedForAdmin,
  updateCuratedMedia,
  uploadCuratedMedia,
} from "@/server/domain/nyx/curated/repository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

export const runtime = "nodejs";

const TIERS: IntimacyTier[] = ["EARLY", "FRIEND", "TRUST"];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const scoped = await resolveAdminScope(admin, "/api/admin/nyx-curated");
  const items = await listCuratedForAdmin(scoped.id);
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Geen bestand." }, { status: 400 });
  }
  const tier = String(form.get("minIntimacyTier") ?? "EARLY") as IntimacyTier;
  if (!TIERS.includes(tier)) {
    return NextResponse.json({ ok: false, error: "Ongeldige band/tier." }, { status: 400 });
  }
  const description = String(form.get("description") ?? "").trim();
  if (!description) {
    return NextResponse.json({ ok: false, error: "Beschrijving is verplicht (voor AI-keuze)." }, { status: 400 });
  }

  try {
    const item = await uploadCuratedMedia({
      bytes: await file.arrayBuffer(),
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      description,
      minIntimacyTier: tier,
      label: String(form.get("label") ?? "") || undefined,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  let body: { id?: string; description?: string; minIntimacyTier?: string; label?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "Geen id." }, { status: 400 });
  if (body.minIntimacyTier && !TIERS.includes(body.minIntimacyTier as IntimacyTier)) {
    return NextResponse.json({ ok: false, error: "Ongeldige tier." }, { status: 400 });
  }

  try {
    const item = await updateCuratedMedia(body.id, {
      description: body.description,
      minIntimacyTier: body.minIntimacyTier as IntimacyTier | undefined,
      label: body.label,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opslaan mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Geen id." }, { status: 400 });
  await deleteCuratedMedia(id);
  return NextResponse.json({ ok: true });
}
