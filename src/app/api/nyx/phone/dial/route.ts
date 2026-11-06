import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { dialNyxPhone } from "@/server/ai/services/NyxPhoneService";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });

  try {
    const result = await dialNyxPhone(player.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: string }).message ?? "Bellen mislukt.")
          : "Bellen mislukt.";
    console.error("[nyx/phone/dial]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
