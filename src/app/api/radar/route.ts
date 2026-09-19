import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { getRadar, ingestOpportunity } from "@/server/ai/services/OpportunityIntelligenceService";
import type { OpportunityDraft } from "@/server/domain/opportunity/types";

export const runtime = "nodejs";

export async function GET() {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  const radar = await getRadar(player.id);
  return NextResponse.json({ ok: true, items: radar.items, createdMission: radar.createdMission });
}

export async function POST(request: Request) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  let draft: OpportunityDraft;
  try {
    draft = (await request.json()) as OpportunityDraft;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }
  try {
    const result = await ingestOpportunity(player.id, draft);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opportunity kon niet worden bewaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
