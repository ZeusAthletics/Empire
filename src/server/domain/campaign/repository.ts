import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapCampaign, type CampaignRow, type ChapterRow, type PublicCampaign } from "@/server/domain/campaign/types";

export async function findPublicCampaignByPlayerId(playerId: string): Promise<PublicCampaign | null> {
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

  return mapCampaign(row, chapter);
}
