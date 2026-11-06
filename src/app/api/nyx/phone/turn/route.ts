import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { handleNyxPhoneTurn } from "@/server/ai/services/NyxPhoneService";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

  try {
    const form = await request.formData();
    const callId = String(form.get("callId") ?? "").trim();
    const file = form.get("audio");
    if (!callId) {
      return NextResponse.json({ ok: false, error: "callId ontbreekt." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Audio ontbreekt." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) {
      return NextResponse.json({ ok: false, error: "Lege opname." }, { status: 400 });
    }

    const result = await handleNyxPhoneTurn({
      playerId: player.id,
      callId,
      audioBytes: bytes,
      filename: file.name || "call.webm",
      mimeType: file.type || "audio/webm",
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, creditEmpty: result.creditEmpty === true },
        { status: result.creditEmpty ? 402 : 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Belbeurt mislukt.";
    console.error("[nyx/phone/turn]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
