import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { jsonMissionError } from "@/server/domain/mission/http";
import { continueMission } from "@/server/domain/mission/repository";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) {
    return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  }

  let objectiveId: string | undefined;
  try {
    const body = (await request.json()) as { objectiveId?: string };
    objectiveId = body.objectiveId;
  } catch {
    objectiveId = undefined;
  }

  try {
    const { id } = await params;
    const result = await continueMission(player.id, id, objectiveId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonMissionError(error);
  }
}
