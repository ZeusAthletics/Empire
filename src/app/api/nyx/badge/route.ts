import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { nyxBadgeCounts } from "@/server/domain/nyx/unreadMedia";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const counts = await nyxBadgeCounts(player.id);
  return NextResponse.json({ ok: true, ...counts, unreadMedia: counts.unreadMedia });
}
