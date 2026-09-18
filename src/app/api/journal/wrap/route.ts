import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { generateMonthlyWrap } from "@/server/domain/journal/repository";

export const runtime = "nodejs";

export async function POST() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  try {
    const wrap = await generateMonthlyWrap(player.id);
    return NextResponse.json({ ok: true, wrap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wrap kon niet worden gemaakt.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
