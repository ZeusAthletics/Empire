import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { saveOpportunity } from "@/server/ai/services/OpportunityIntelligenceService";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  try {
    const { id } = await params;
    const result = await saveOpportunity(player.id, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opportunity kon niet worden bewaard.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
