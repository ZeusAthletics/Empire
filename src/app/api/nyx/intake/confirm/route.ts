import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { playerNeedsIntake } from "@/server/auth/intakeGate";
import { confirmIntake } from "@/server/ai/services/IntakeConfirmService";

export const runtime = "nodejs";

export async function POST() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  if (!playerNeedsIntake(player)) {
    return NextResponse.json({ ok: true, next: "/home", missionCount: 0 });
  }
  try {
    const result = await confirmIntake(player.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intake kon niet worden bevestigd.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
