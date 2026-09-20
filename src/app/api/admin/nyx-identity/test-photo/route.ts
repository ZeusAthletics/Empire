import { NextResponse } from "next/server";
import { resolveAdminScope } from "@/admin/scope";
import { requireAdmin } from "@/server/auth/session";
import { forceNyxTestPhoto } from "@/server/ai/services/NyxOutreachService";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 403 });

  const scoped = await resolveAdminScope(operator, "/api/admin/nyx-identity/test-photo");
  let body: { scene?: string; caption?: string } = {};
  try {
    body = (await request.json()) as { scene?: string; caption?: string };
  } catch {
    body = {};
  }

  try {
    const result = await forceNyxTestPhoto(scoped.id, body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason, reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ...result, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Testfoto mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
