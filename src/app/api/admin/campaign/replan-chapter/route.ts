import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { replanChapterInPlace } from "@/server/domain/campaign/director/CampaignDirector";
import { formatReplanError, formatReplanReason } from "@/server/domain/campaign/director/replanErrors";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/campaign/replan-chapter");

  try {
    const result = await replanChapterInPlace(scoped.id);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: formatReplanReason(result.reason ?? "Replan mislukt.") },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, error: message } = formatReplanError(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
