import { openaiConfigured } from "@/server/ai/client/openai";
import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { NYX_RELATIONSHIP_GUIDE } from "@/server/ai/prompts/nyx-relationship";
import {
  NYX_RELATIONSHIP_JSON_SCHEMA,
  parseRelationshipReview,
  type NyxRelationshipReview,
} from "@/server/ai/schemas/relationship.schema";
import { listActiveMemories } from "@/server/domain/memory/repository";
import { collectOutreachHooks } from "@/server/domain/nyx/outreach/hooks";
import { computeIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import { INTIMACY_TIER_LABELS } from "@/server/domain/nyx/curated/tier";
import { insertRelationshipSnapshot, type RelationshipSnapshot } from "@/server/domain/nyx/relationship/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function offlineReview(input: {
  intimacyTier: Awaited<ReturnType<typeof computeIntimacyTier>>;
  relationshipMemories: number;
  userMessages: number;
}): NyxRelationshipReview {
  const base =
    input.intimacyTier === "TRUST" ? 72 : input.intimacyTier === "FRIEND" ? 55 : 38;
  const trust = Math.min(100, base + Math.min(15, input.relationshipMemories * 3));
  const warmth = Math.min(100, base + Math.min(10, Math.floor(input.userMessages / 10)));
  const tension = Math.max(0, 45 - Math.floor(trust / 3));
  return {
    trustScore: trust,
    warmthScore: warmth,
    tensionScore: tension,
    headline: `Band op ${INTIMACY_TIER_LABELS[input.intimacyTier]} — offline snapshot`,
    analysis: `Ik heb nog geen live modelcall gedaan, maar op basis van wat ik zie: we praten regelmatig (${input.userMessages} berichten van hem), en ik heb ${input.relationshipMemories} actieve relatie-feiten over hem. Mijn tier is ${input.intimacyTier}. Ik blijf alert op consistentie — vertrouwen bouw ik in kleine stappen, niet in één gesprek.`,
    highlights: [
      input.userMessages >= 12 ? "Regelmatig contact in Nyx-chat" : "Contact is nog opbouwfase",
      input.relationshipMemories > 0 ? "Er staan relatie-memories in het systeem" : "Nog weinig expliciete relatie-feiten opgeslagen",
    ],
    concerns: input.intimacyTier === "EARLY" ? ["Band is nog vroeg — ik houd reserve"] : [],
    progressScenarios: [
      {
        id: "organic_pace",
        title: "Organisch vertrouwen",
        summary:
          "We blijven veel tekst, weinig druk. Ik deel geleidelijk meer van mijn echte dagen; hij bewijst consistentie voordat ik warmer word.",
      },
      {
        id: "playful_closer",
        title: "Meer speels contact",
        summary:
          "De band wordt lichter: inside jokes, vaker korte check-ins, soms een foto als het past. Spanning blijft laag zolang hij respectvol blijft.",
      },
    ],
  };
}

async function countUserMessages(playerId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("nyx_messages")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("role", "USER");
  if (error) throw error;
  return count ?? 0;
}

export async function runNyxRelationshipReview(playerId: string): Promise<RelationshipSnapshot> {
  const intimacyTier = await computeIntimacyTier(playerId);
  const [memories, hooks, userMessages] = await Promise.all([
    listActiveMemories(playerId).catch(() => []),
    collectOutreachHooks(playerId).catch(() => ({ hooks: [], recentChat: [] })),
    countUserMessages(playerId).catch(() => 0),
  ]);

  const relMemories = memories.filter(
    (m) => m.domain === "RELATIONSHIP" || m.domain === "PERSONAL" || m.domain === "CONVERSATION_SUMMARY",
  );
  const memoryLines = relMemories.slice(0, 20).map((m) => `[${m.domain}/${m.category}] ${m.content}`);

  let review: NyxRelationshipReview | null = null;
  let runId: string | null = null;

  if (openaiConfigured()) {
    const prompt = `${NYX_RELATIONSHIP_GUIDE}

Intimacy tier (systeem): ${intimacyTier} — ${INTIMACY_TIER_LABELS[intimacyTier]}
User-berichten totaal: ${userMessages}

Memories (selectie):
${memoryLines.length ? memoryLines.join("\n") : "(geen)"}

Outreach hooks:
${hooks.hooks.join("\n") || "(geen)"}

Recent chat:
${hooks.recentChat.join("\n") || "(geen)"}`;

    const result = await runNyxTask({
      playerId,
      task: "NYX_RELATIONSHIP_REVIEW",
      text: prompt,
      invokeModel: true,
      jsonSchema: NYX_RELATIONSHIP_JSON_SCHEMA as unknown as Record<string, unknown>,
    }).catch(() => null);

    runId = result?.runId ?? null;
    review = parseRelationshipReview(result?.text ?? null);
  }

  if (!review) {
    review = offlineReview({
      intimacyTier,
      relationshipMemories: relMemories.length,
      userMessages,
    });
  }

  return insertRelationshipSnapshot({
    playerId,
    trustScore: review.trustScore,
    warmthScore: review.warmthScore,
    tensionScore: review.tensionScore,
    intimacyTier,
    headline: review.headline,
    analysis: review.analysis,
    highlights: review.highlights,
    concerns: review.concerns,
    progressScenarios: review.progressScenarios,
    runId,
  });
}
