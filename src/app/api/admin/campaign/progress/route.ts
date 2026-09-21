import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { forceProgressCampaign } from "@/server/domain/campaign/director/CampaignDirector";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/campaign/progress");

  try {
    const result = await forceProgressCampaign(scoped.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Progression mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
