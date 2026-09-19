import { NextResponse } from "next/server";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { updateHomeAddress } from "@/server/domain/player/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let address = "";
  try {
    const body = (await request.json()) as { address?: string };
    address = body.address ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const updated = await updateHomeAddress(player.id, address);
    return NextResponse.json({ ok: true, player: toPublicPlayer(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Home Base kon niet worden bewaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
