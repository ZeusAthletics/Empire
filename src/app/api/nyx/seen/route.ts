import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { markNyxMediaSeen } from "@/server/domain/nyx/unreadMedia";

export const runtime = "nodejs";

export async function POST() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const marked = await markNyxMediaSeen(player.id);
  return NextResponse.json({ ok: true, marked });
}
