import { maybeProposeCampaignReview } from "@/server/ai/services/CampaignReviewService";
import { runRadarJob } from "@/server/ai/services/OpportunityIntelligenceService";
import { detectAndStorePatterns } from "@/server/ai/services/StrategicPatternService";
import { repairCampaignHealth } from "@/server/domain/campaign/director/CampaignHealthService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function runNyxNightJob() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("players").select("id").eq("role", "PLAYER");
  if (error) throw error;
  let players = 0;
  let patterns = 0;
  for (const row of data ?? []) {
    players += 1;
    const detected = await detectAndStorePatterns(row.id as string);
    patterns += detected.surfaced.length;
    await maybeProposeCampaignReview(row.id as string);
    await repairCampaignHealth(row.id as string).catch(() => undefined);
    await runRadarJob(row.id as string);
  }
  return { players, patterns };
}
