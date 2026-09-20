import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { countUnseenNyxMedia } from "@/server/domain/nyx/unreadMedia";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const unreadMedia = await countUnseenNyxMedia(player.id);
  return NextResponse.json({ ok: true, unreadMedia });
}
