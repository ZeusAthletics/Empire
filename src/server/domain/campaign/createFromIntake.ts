import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StatKey } from "@/server/domain/player/types";
import { STAT_KEYS } from "@/server/domain/player/types";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import type { PublicCampaign } from "@/server/domain/campaign/types";

export type IntakeCampaignDraft = {
  title: string;
  northStar: string;
  bottleneckStat: StatKey;
  bottleneckReason: string;
  chapterName: string;
  chapterTagline: string;
  economicCurrent: number;
  economicTo: number;
  exitCriteria: string;
};

function asStat(value: string | undefined): StatKey {
  return STAT_KEYS.includes(value as StatKey) ? (value as StatKey) : "optionality";
}

export async function createCampaignFromIntake(
  playerId: string,
  draft: IntakeCampaignDraft,
): Promise<PublicCampaign> {
  const existing = await findPublicCampaignByPlayerId(playerId);
  if (existing) return existing;

  const admin = createSupabaseAdminClient();
  const current = Math.max(0, Math.round(Number(draft.economicCurrent) || 0));
  const to = Math.max(current + 10000, Math.round(Number(draft.economicTo) || 100000));
  const bottleneck = asStat(draft.bottleneckStat);

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .insert({
      player_id: playerId,
      title: draft.title.trim() || `€${current} → €${to}`,
      north_star: draft.northStar.trim() || "Een eigen pad, niet het pad van een ander.",
      bottleneck_stat: bottleneck,
      bottleneck_reason: draft.bottleneckReason.trim() || "Nog te weinig opties naast het huidige werk.",
      status: "ACTIVE",
      source: "USER",
      locked_by_admin: false,
    } as never)
    .select("*")
    .single();
  if (campaignError || !campaign) throw campaignError ?? new Error("Campagne kon niet worden aangemaakt.");

  const { data: chapter, error: chapterError } = await admin
    .from("chapters")
    .insert({
      campaign_id: campaign.id,
      player_id: playerId,
      index: 1,
      roman: "I",
      name: (draft.chapterName.trim() || "HOOFDSTUK I").toUpperCase(),
      tagline: draft.chapterTagline.trim() || "Eerst het profiel. Dan de missies.",
      economic_from: 0,
      economic_to: to,
      economic_current: current,
      exit_criteria: [draft.exitCriteria.trim() || "Het eerste meetbare doel is gehaald."],
      status: "ACTIVE",
      opened_at: new Date().toISOString(),
      source: "USER",
      locked_by_admin: false,
    } as never)
    .select("id")
    .single();
  if (chapterError || !chapter) throw chapterError ?? new Error("Hoofdstuk kon niet worden aangemaakt.");

  const { error: linkError } = await admin
    .from("campaigns")
    .update({ current_chapter_id: chapter.id } as never)
    .eq("id", campaign.id);
  if (linkError) throw linkError;

  if (current > 0) {
    await admin.from("empire_value_entries").insert({
      player_id: playerId,
      chapter_id: chapter.id,
      delta: current,
      value_after: current,
      note: "Startpunt hoofdstuk",
    } as never);
  }

  const created = await findPublicCampaignByPlayerId(playerId);
  if (!created) throw new Error("Campagne is aangemaakt maar niet leesbaar.");
  return created;
}
