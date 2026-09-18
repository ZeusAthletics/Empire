import { NextResponse } from "next/server";
import { getSessionPlayer, toPublicPlayer } from "@/server/auth/session";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) {
    return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  }

  const campaign = await findPublicCampaignByPlayerId(player.id);

  return NextResponse.json({
    ok: true,
    db: "live",
    player: toPublicPlayer(player),
    campaign,
  });
}
