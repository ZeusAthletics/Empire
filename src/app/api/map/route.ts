import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { getMapState } from "@/server/domain/map/repository";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const state = await getMapState(player.id);
  return NextResponse.json({ ok: true, ...state });
}
