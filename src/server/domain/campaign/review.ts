import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CampaignReviewPayload } from "@/server/ai/schemas/campaign-review.schema";
import { CampaignRuleError } from "@/server/validation/CampaignRuleEngine";
import type { CampaignRow, ChapterRow } from "@/server/domain/campaign/types";
import type { StatKey } from "@/server/domain/player/types";

const STATS = new Set<StatKey>([
  "capital",
  "income",
  "ownership",
  "network",
  "authority",
  "strategy",
  "execution",
  "optionality",
]);

export async function getCampaignRecord(playerId: string) {
  const admin = createSupabaseAdminClient();
  const { data: campaign, error } = await admin
    .from("campaigns")
    .select("*")
    .eq("player_id", playerId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!campaign) return null;
  const row = campaign as CampaignRow;
  let chapter: ChapterRow | null = null;
  if (row.current_chapter_id) {
    const { data, error: chapterError } = await admin
      .from("chapters")
      .select("*")
      .eq("id", row.current_chapter_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (chapterError) throw chapterError;
    chapter = (data as ChapterRow | null) ?? null;
  }
  return { campaign: row, chapter };
}

export function applyReviewDecision(
  payload: CampaignReviewPayload,
  current: { lockedByAdmin: boolean; bottleneckStat: StatKey; chapterId: string | null },
) {
  if (current.lockedByAdmin) {
    throw new CampaignRuleError("Admin-locked campagne mag niet worden overschreven.");
  }
  const nextBottleneck =
    !payload.keepBottleneck && payload.proposedBottleneck && STATS.has(payload.proposedBottleneck)
      ? payload.proposedBottleneck
      : current.bottleneckStat;
  return {
    bottleneckStat: nextBottleneck,
    chapterId: current.chapterId,
    chapterDeleted: false,
  };
}

export async function applyCampaignReview(playerId: string, payload: CampaignReviewPayload) {
  const record = await getCampaignRecord(playerId);
  if (!record) throw new Error("Campagne niet gevonden.");
  const decision = applyReviewDecision(payload, {
    lockedByAdmin: record.campaign.locked_by_admin,
    bottleneckStat: record.campaign.bottleneck_stat,
    chapterId: record.chapter?.id ?? record.campaign.current_chapter_id,
  });
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("campaigns")
    .update({
      bottleneck_stat: decision.bottleneckStat,
      bottleneck_reason: payload.evidence[0] ?? record.campaign.bottleneck_reason,
      bottleneck_set_at: new Date().toISOString(),
    } as never)
    .eq("id", record.campaign.id)
    .eq("player_id", playerId);
  if (error) throw error;
  return {
    bottleneckStat: decision.bottleneckStat,
    chapterId: record.chapter?.id ?? null,
    chapterName: record.chapter?.name ?? null,
    chapterDeleted: false,
  };
}
