import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/session";
import { resolveAdminScope } from "@/admin/scope";
import { decideFromAdmin } from "@/server/domain/nyx/proposalRepository";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 401 });

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ ok: false, error: "Actie ontbreekt." }, { status: 400 });
  }

  try {
    const scoped = await resolveAdminScope(operator, "/api/admin/proposals");
    const { id } = await params;
    const result = await decideFromAdmin(scoped.id, id, body.action);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Beslissing mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
