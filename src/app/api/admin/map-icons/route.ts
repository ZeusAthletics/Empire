import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { listMapIconSets, setMapIconSetActive } from "@/server/domain/map/iconSets";

export const runtime = "nodejs";

export async function GET() {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });
  try {
    const sets = await listMapIconSets(false);
    return NextResponse.json({ ok: true, sets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Iconensets laden mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  let body: { slug?: string; active?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  const slug = body.slug?.trim();
  if (!slug || typeof body.active !== "boolean") {
    return NextResponse.json({ ok: false, error: "slug en active zijn verplicht." }, { status: 400 });
  }

  try {
    const set = await setMapIconSetActive(slug, body.active);
    return NextResponse.json({ ok: true, set });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opslaan mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
