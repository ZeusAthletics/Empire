import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { listNyxGallery } from "@/server/domain/nyx/galleryRepository";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const items = await listNyxGallery(player.id);
  return NextResponse.json({ ok: true, items });
}
