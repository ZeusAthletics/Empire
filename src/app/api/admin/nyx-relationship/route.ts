import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { runNyxRelationshipReview } from "@/server/ai/services/NyxRelationshipService";
import { setMediaBudget } from "@/server/domain/nyx/relationship/mediaBudget";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-relationship");

  try {
    const snapshot = await runNyxRelationshipReview(scoped.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relatie-update mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-relationship");

  let body: { maxPhotosPerDay?: number; maxVideosPerDay?: number };
  try {
    body = (await request.json()) as { maxPhotosPerDay?: number; maxVideosPerDay?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  try {
    const budget = await setMediaBudget(scoped.id, {
      maxPhotosPerDay: body.maxPhotosPerDay,
      maxVideosPerDay: body.maxVideosPerDay,
    });
    return NextResponse.json({ ok: true, budget });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Budget opslaan mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
