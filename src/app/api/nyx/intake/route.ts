import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { playerNeedsIntake } from "@/server/auth/intakeGate";
import { getIntakeTalk, sendIntakeMessage } from "@/server/ai/services/IntakeConversationService";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  if (!playerNeedsIntake(player)) return NextResponse.json({ ok: false, error: "Intake is al afgerond." }, { status: 409 });
  const talk = await getIntakeTalk(player.id);
  return NextResponse.json({ ok: true, talk });
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  if (!playerNeedsIntake(player)) return NextResponse.json({ ok: false, error: "Intake is al afgerond." }, { status: 409 });
  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = body.text ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const talk = await sendIntakeMessage(player.id, text);
    return NextResponse.json({ ok: true, talk });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nyx kon niet antwoorden.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
