import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/server/auth/session";
import { getNyxTalk } from "@/server/ai/services/NyxConversationService";
import { confirmSurfacedPattern } from "@/server/ai/services/StrategicPatternService";
import { approvePatternProposal, getProposal } from "@/server/domain/nyx/proposalRepository";
import { isPatternPayload } from "@/server/domain/nyx/proposalTypes";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const player = await getSessionPlayer();
  if (!player) return NextResponse.json({ ok: false, error: "Niet aangemeld." }, { status: 401 });
  try {
    const { id } = await params;
    const proposal = await getProposal(player.id, id);
    const payload = await approvePatternProposal(player.id, id);
    if (isPatternPayload(proposal.payload)) {
      await confirmSurfacedPattern(player.id, proposal.payload.patternId ?? "", payload.strategicImpact);
    }
    const talk = await getNyxTalk(player.id);
    return NextResponse.json({ ok: true, talk });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Patroon kon niet worden bevestigd.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
