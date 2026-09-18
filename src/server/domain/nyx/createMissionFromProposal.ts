import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SideQuestProposalPayload } from "@/server/domain/nyx/proposalTypes";
import { getMission } from "@/server/domain/mission/repository";
import type { MissionDifficulty, PublicMission } from "@/server/domain/mission/types";
import { assertNoRestrictedTargets } from "@/server/validation/missionRuleEngine";

function mapDifficulty(value: string): MissionDifficulty {
  const key = value.toUpperCase();
  if (key === "LOW" || key === "MEDIUM" || key === "HIGH" || key === "BOSS") return key;
  return "MEDIUM";
}

export async function createMissionFromProposal(
  playerId: string,
  proposalId: string,
  payload: SideQuestProposalPayload,
): Promise<PublicMission> {
  const admin = createSupabaseAdminClient();
  const blueprint = payload.blueprint;
  const { data: contacts, error: contactError } = await admin
    .from("contacts")
    .select("id, seed_key, restricted")
    .eq("player_id", playerId)
    .is("deleted_at", null);
  if (contactError) throw contactError;

  const bySeed = new Map((contacts ?? []).map((row) => [row.seed_key as string, row]));
  const targetIds = blueprint.people
    .map((key) => bySeed.get(key)?.id as string | undefined)
    .filter((id): id is string => Boolean(id));
  assertNoRestrictedTargets(
    (contacts ?? []).map((row) => ({ id: row.id as string, restricted: Boolean(row.restricted) })),
    targetIds,
  );

  const { data: campaign } = await admin
    .from("campaigns")
    .select("current_chapter_id")
    .eq("player_id", playerId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();

  const { data: mission, error } = await admin
    .from("missions")
    .insert({
      player_id: playerId,
      chapter_id: (campaign?.current_chapter_id as string | null) ?? null,
      origin_proposal_id: proposalId,
      kind: blueprint.kind,
      track: blueprint.track,
      title: payload.title,
      why: blueprint.why,
      main_objective: blueprint.mainObjective,
      status: "ACTIVE",
      difficulty: mapDifficulty(payload.difficulty),
      estimate_label: blueprint.estimate,
      impact: payload.impact,
      xp_reward: payload.xp,
      xp_granted: 0,
      stat_reward_key: blueprint.statReward.key,
      stat_reward_amount: blueprint.statReward.amount,
      evidence_requirement: blueprint.evidence,
      location_name: blueprint.locationName,
      lat: blueprint.lat,
      lng: blueprint.lng,
      featured: false,
      source: "AI",
    } as never)
    .select("id")
    .single();
  if (error || !mission) throw error ?? new Error("Missie kon niet worden aangemaakt.");

  if (blueprint.objectives.length) {
    const { error: objError } = await admin.from("mission_objectives").insert(
      blueprint.objectives.map((objective, index) => ({
        mission_id: mission.id,
        label: objective.label,
        sort_order: index,
        optional: false,
        status: "OPEN",
      })) as never,
    );
    if (objError) throw objError;
  }

  if (targetIds.length) {
    const { error: linkError } = await admin.from("mission_contacts").insert(
      targetIds.map((contactId) => ({ mission_id: mission.id, contact_id: contactId })) as never,
    );
    if (linkError) throw linkError;
  }

  return getMission(playerId, mission.id as string);
}
