import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { prepareCuratedDirectUpload } from "@/server/domain/nyx/curated/repository";
import type { IntimacyTier } from "@/server/domain/nyx/outreach/intimacy";

export const runtime = "nodejs";

const TIERS: IntimacyTier[] = ["EARLY", "FRIEND", "TRUST"];

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  let body: {
    filename?: string;
    contentType?: string;
    description?: string;
    minIntimacyTier?: string;
    label?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const tier = (body.minIntimacyTier ?? "EARLY") as IntimacyTier;
  if (!TIERS.includes(tier)) {
    return NextResponse.json({ ok: false, error: "Ongeldige band/tier." }, { status: 400 });
  }
  const description = String(body.description ?? "").trim();
  if (!description) {
    return NextResponse.json({ ok: false, error: "Beschrijving is verplicht." }, { status: 400 });
  }
  const filename = String(body.filename ?? "upload.jpg");

  try {
    const { item, signedUrl } = await prepareCuratedDirectUpload({
      filename,
      contentType: String(body.contentType ?? ""),
      description,
      minIntimacyTier: tier,
      label: body.label,
    });
    return NextResponse.json({ ok: true, item, signedUrl, itemId: item.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voorbereiden mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
