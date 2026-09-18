import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { listMissions } from "@/server/domain/mission/repository";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) {
    return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  }
  const missions = await listMissions(player.id);
  return NextResponse.json({ ok: true, missions });
}
