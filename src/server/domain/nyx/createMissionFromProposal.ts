import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { matchContactKeys } from "@/server/domain/contact/match";
import { resolveMissionLocation } from "@/server/domain/geo/geocode";
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
  const first = await admin
    .from("contacts")
    .select("id, seed_key, name, restricted, lat, lng, address")
    .eq("player_id", playerId)
    .is("deleted_at", null);
  let raw = first.data as Record<string, unknown>[] | null;
  let contactError = first.error;
  if (contactError && /address|schema cache|column/i.test(contactError.message)) {
    const retry = await admin
      .from("contacts")
      .select("id, seed_key, name, restricted, lat, lng")
      .eq("player_id", playerId)
      .is("deleted_at", null);
    raw = retry.data as Record<string, unknown>[] | null;
    contactError = retry.error;
  }
  if (contactError) throw contactError;

  const rows = (raw ?? []).map((row) => ({
    id: row.id as string,
    seed_key: (row.seed_key as string | null) ?? null,
    name: row.name as string,
    restricted: Boolean(row.restricted),
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    address: (row.address as string | null) ?? null,
  }));
  const targetIds = matchContactKeys(blueprint.people ?? [], rows);
  assertNoRestrictedTargets(
    rows.map((row) => ({ id: row.id, restricted: Boolean(row.restricted) })),
    targetIds,
  );

  const matched = rows.filter((row) => targetIds.includes(row.id));
  const geo = await resolveMissionLocation({
    locationName: blueprint.locationName,
    locationAddress: blueprint.locationAddress,
    lat: Number.isFinite(Number(blueprint.lat)) ? Number(blueprint.lat) : null,
    lng: Number.isFinite(Number(blueprint.lng)) ? Number(blueprint.lng) : null,
    contactPoints: matched.flatMap((row) =>
      row.lat != null && row.lng != null
        ? [{ lat: row.lat, lng: row.lng, address: row.address }]
        : row.address
          ? [{ lat: 0, lng: 0, address: row.address }]
          : [],
    ),
  });

  const { data: campaign } = await admin
    .from("campaigns")
    .select("current_chapter_id")
    .eq("player_id", playerId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();

  const initialStatus = blueprint.track === "MAIN_STORY" ? "PROPOSED" : "ACTIVE";

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
      status: initialStatus,
      difficulty: mapDifficulty(payload.difficulty),
      estimate_label: blueprint.estimate,
      impact: payload.impact,
      xp_reward: payload.xp,
      xp_granted: 0,
      stat_reward_key: blueprint.statReward.key,
      stat_reward_amount: blueprint.statReward.amount,
      evidence_requirement: blueprint.evidence,
      location_name: blueprint.locationName ?? geo?.label ?? null,
      location_address: geo?.address ?? blueprint.locationAddress ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      featured: false,
      source: "AI",
    } as never)
    .select("id")
    .single();
  if (error || !mission) throw error ?? new Error("Missie kon niet worden aangemaakt.");

  if ((blueprint.objectives ?? []).length) {
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
