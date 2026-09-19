import { NextResponse } from "next/server";
import { getSessionPlayer, requireAdmin } from "@/server/auth/session";
import { resolveAdminScope } from "@/admin/scope";
import { downloadMedia, getMedia, setMediaApproved } from "@/server/domain/media/repository";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await getMedia(id);
  if (!asset) return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });

  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const isAdmin = player.role === "ADMIN";
  if (!asset.approved && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Nog niet goedgekeurd." }, { status: 403 });
  }
  if (!isAdmin && asset.playerId !== player.id) {
    return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 403 });
  }

  try {
    const blob = await downloadMedia(asset);
    return new NextResponse(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Cache-Control": asset.approved ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Bestand ontbreekt." }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const operator = await requireAdmin();
  if (!operator) return NextResponse.json({ ok: false, error: "Niet gemachtigd." }, { status: 401 });
  const scoped = await resolveAdminScope(operator, "/api/media");
  const { id } = await params;
  let body: { approved?: boolean };
  try {
    body = (await request.json()) as { approved?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const asset = await setMediaApproved(scoped.id, id, Boolean(body.approved));
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
