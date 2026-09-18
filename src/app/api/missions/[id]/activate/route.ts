import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { jsonMissionError } from "@/server/domain/mission/http";
import { activateMission } from "@/server/domain/mission/repository";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) {
    return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const mission = await activateMission(player.id, id);
    return NextResponse.json({ ok: true, mission, message: "Missie geactiveerd" });
  } catch (error) {
    return jsonMissionError(error);
  }
}
