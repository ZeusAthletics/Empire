import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { hangupNyxPhone } from "@/server/ai/services/NyxPhoneService";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

  try {
    const body = (await request.json()) as { callId?: string };
    const callId = body.callId?.trim();
    if (!callId) {
      return NextResponse.json({ ok: false, error: "callId ontbreekt." }, { status: 400 });
    }
    const result = await hangupNyxPhone(player.id, callId);
    return NextResponse.json({ ok: result.ok, summarized: result.summarized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ophangen mislukt.";
    console.error("[nyx/phone/hangup]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
