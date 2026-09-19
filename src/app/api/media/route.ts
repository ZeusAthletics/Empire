import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { resolveAdminScope } from "@/admin/scope";
import { listMedia, uploadMedia } from "@/server/domain/media/repository";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const scopedId = player.role === "ADMIN" ? (await resolveAdminScope(player, "/api/media")).id : player.id;
  const assets = await listMedia(scopedId);
  return NextResponse.json({
    ok: true,
    assets: assets.map((asset) => ({
      ...asset,
      src: asset.approved ? `/api/media/${asset.id}` : null,
    })),
  });
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Geen bestand." }, { status: 400 });
  }

  const ownerId = player.role === "ADMIN" ? (await resolveAdminScope(player, "/api/media")).id : player.id;

  try {
    const asset = await uploadMedia({
      playerId: ownerId,
      bytes: await file.arrayBuffer(),
      filename: file.name,
      contentType: file.type,
      kind: String(form.get("kind") ?? "JOURNAL"),
    });
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload mislukt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
