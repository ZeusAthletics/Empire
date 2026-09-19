import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  doneCount,
  requiredCount,
  type MissionDifficulty,
  type MissionKind,
  type MissionStatus,
  type MissionTrack,
  type ObjectiveStatus,
  type PublicMission,
  type PublicObjective,
} from "@/server/domain/mission/types";
import type { StatKey } from "@/server/domain/player/types";
import { coverMapForMediaIds } from "@/server/domain/media/missionCover";
import { RestrictedContactError, assertNoRestrictedTargets } from "@/server/validation/missionRuleEngine";
import {
  MissionClosedError,
  MissionLockedError,
  applyXpToPlayer,
  attestObjective,
  finalizeMission,
  type RewardMission,
} from "@/server/validation/rewardEngine";

type MissionRow = {
  id: string;
  player_id: string;
  seed_key: string | null;
  kind: MissionKind;
  track: MissionTrack;
  title: string;
  why: string;
  main_objective: string;
  status: MissionStatus;
  difficulty: MissionDifficulty;
  estimate_label: string | null;
  impact: string | null;
  xp_reward: number;
  xp_granted: number;
  stat_reward_key: StatKey;
  stat_reward_amount: number;
  evidence_requirement: string;
  location_name: string | null;
  location_address: string | null;
  featured: boolean;
  when_label: string | null;
  media_id?: string | null;
};

type ObjectiveRow = {
  id: string;
  mission_id: string;
  label: string;
  optional: boolean;
  status: ObjectiveStatus;
  sort_order: number;
};

function mapMission(
  row: MissionRow,
  objectives: ObjectiveRow[],
  contacts: { id: string; name: string; role: string | null }[],
): PublicMission {
  return {
    id: row.id,
    seedKey: row.seed_key,
    kind: row.kind,
    track: row.track,
    title: row.title,
    why: row.why,
    mainObjective: row.main_objective,
    status: row.status,
    difficulty: row.difficulty,
    estimateLabel: row.estimate_label,
    impact: row.impact,
    xpReward: row.xp_reward,
    xpGranted: row.xp_granted,
    statReward: { key: row.stat_reward_key, amount: row.stat_reward_amount },
    evidenceRequirement: row.evidence_requirement,
    locationName: row.location_name,
    locationAddress: row.location_address,
    featured: row.featured,
    whenLabel: row.when_label,
    coverSrc: null,
    coverApproved: false,
    objectives: [...objectives]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((objective) => ({
        id: objective.id,
        label: objective.label,
        optional: objective.optional,
        status: objective.status,
      })),
    contacts,
  };
}

async function withCovers(missions: PublicMission[], rows: MissionRow[]): Promise<PublicMission[]> {
  const covers = await coverMapForMediaIds(rows.map((row) => row.media_id ?? "").filter(Boolean));
  return missions.map((mission, index) => {
    const mediaId = rows[index]?.media_id;
    const cover = mediaId ? covers.get(mediaId) : undefined;
    return cover ? { ...mission, coverSrc: cover.src, coverApproved: cover.approved } : mission;
  });
}

async function loadMission(playerId: string, missionId: string): Promise<{
  row: MissionRow;
  objectives: ObjectiveRow[];
  mission: PublicMission;
}> {
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .eq("player_id", playerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Missie niet gevonden.");

  const { data: objectives, error: objError } = await admin
    .from("mission_objectives")
    .select("*")
    .eq("mission_id", missionId)
    .is("deleted_at", null);
  if (objError) throw objError;

  const { data: links, error: linkError } = await admin
    .from("mission_contacts")
    .select("contact_id")
    .eq("mission_id", missionId);
  if (linkError) throw linkError;

  const contactIds = (links ?? []).map((link) => link.contact_id as string);
  let contacts: { id: string; name: string; role: string | null }[] = [];
  if (contactIds.length) {
    const { data, error: contactError } = await admin
      .from("contacts")
      .select("id, name, role, restricted")
      .in("id", contactIds)
      .is("deleted_at", null);
    if (contactError) throw contactError;
    contacts = (data ?? [])
      .filter((contact) => !contact.restricted)
      .map((contact) => ({ id: contact.id as string, name: contact.name as string, role: (contact.role as string | null) ?? null }));
  }

  const missionRow = row as MissionRow;
  const objectiveRows = (objectives ?? []) as ObjectiveRow[];
  const [mission] = await withCovers([mapMission(missionRow, objectiveRows, contacts)], [missionRow]);
  return { row: missionRow, objectives: objectiveRows, mission };
}

export async function listMissions(playerId: string): Promise<PublicMission[]> {
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("missions")
    .select("*")
    .eq("player_id", playerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const missions = (rows ?? []) as MissionRow[];
  const ids = missions.map((row) => row.id);
  if (!ids.length) return [];

  const { data: objectives, error: objError } = await admin
    .from("mission_objectives")
    .select("*")
    .in("mission_id", ids)
    .is("deleted_at", null);
  if (objError) throw objError;

  const { data: links, error: linkError } = await admin.from("mission_contacts").select("mission_id, contact_id").in("mission_id", ids);
  if (linkError) throw linkError;

  const contactIds = [...new Set((links ?? []).map((link) => link.contact_id as string))];
  const { data: contactRows } = contactIds.length
    ? await admin.from("contacts").select("id, name, role, restricted").in("id", contactIds).is("deleted_at", null)
    : { data: [] };

  const contactsById = new Map(
    (contactRows ?? [])
      .filter((contact) => !contact.restricted)
      .map((contact) => [contact.id as string, { id: contact.id as string, name: contact.name as string, role: (contact.role as string | null) ?? null }]),
  );

  return withCovers(
    missions.map((row) =>
      mapMission(
        row,
        ((objectives ?? []) as ObjectiveRow[]).filter((objective) => objective.mission_id === row.id),
        (links ?? [])
          .filter((link) => link.mission_id === row.id)
          .map((link) => contactsById.get(link.contact_id as string))
          .filter((contact): contact is { id: string; name: string; role: string | null } => Boolean(contact)),
      ),
    ),
    missions,
  );
}

export async function getMission(playerId: string, missionId: string): Promise<PublicMission> {
  return (await loadMission(playerId, missionId)).mission;
}

export { featuredMission } from "@/server/domain/mission/types";

export async function activateMission(playerId: string, missionId: string): Promise<PublicMission> {
  const admin = createSupabaseAdminClient();
  const loaded = await loadMission(playerId, missionId);
  if (loaded.row.status === "LOCKED") throw new MissionLockedError();
  if (loaded.row.status !== "PROPOSED") return loaded.mission;

  const { data: links } = await admin.from("mission_contacts").select("contact_id").eq("mission_id", missionId);
  const ids = (links ?? []).map((link) => link.contact_id as string);
  if (ids.length) {
    const { data: contacts } = await admin.from("contacts").select("id, restricted").in("id", ids);
    assertNoRestrictedTargets(
      (contacts ?? []).map((contact) => ({ id: contact.id as string, restricted: Boolean(contact.restricted) })),
      ids,
    );
  }

  const { error } = await admin.from("missions").update({ status: "ACTIVE" } as never).eq("id", missionId).eq("player_id", playerId);
  if (error) throw error;
  return (await loadMission(playerId, missionId)).mission;
}

export async function continueMission(playerId: string, missionId: string, objectiveId?: string) {
  const loaded = await loadMission(playerId, missionId);
  if (loaded.row.status === "LOCKED") throw new MissionLockedError();
  if (loaded.row.status === "COMPLETED" || loaded.row.status === "COMPLETED_UNVERIFIED") {
    throw new MissionClosedError();
  }
  const targetId =
    objectiveId ??
    loaded.mission.objectives.find((objective) => !objective.optional && objective.status === "OPEN")?.id;
  if (targetId) return attestAndPersist(playerId, loaded, targetId);
  if (doneCount(loaded.mission) >= requiredCount(loaded.mission) && loaded.row.status === "ACTIVE") {
    return finalizeAndPersist(playerId, loaded);
  }
  return { mission: loaded.mission, xpDelta: 0, message: "Alle verplichte objectieven zijn afgevinkt." };
}

async function attestAndPersist(
  playerId: string,
  loaded: { row: MissionRow; objectives: ObjectiveRow[]; mission: PublicMission },
  objectiveId: string,
) {
  const rewardState: RewardMission = {
    kind: loaded.row.kind,
    status: loaded.row.status,
    xpReward: loaded.row.xp_reward,
    xpGranted: loaded.row.xp_granted,
    statReward: { key: loaded.row.stat_reward_key, amount: loaded.row.stat_reward_amount },
    objectives: loaded.mission.objectives.map((objective) => ({
      id: objective.id,
      optional: objective.optional,
      status: objective.status,
    })),
  };
  const result = attestObjective(rewardState, objectiveId);
  const admin = createSupabaseAdminClient();

  const { data: evidence, error: evidenceError } = await admin
    .from("evidence")
    .insert({
      player_id: playerId,
      kind: "USER_ATTESTED",
      mission_id: loaded.row.id,
      objective_id: objectiveId,
      note: "Afgevinkt in Empire Mode.",
    } as never)
    .select("id")
    .single();
  if (evidenceError || !evidence) throw evidenceError ?? new Error("Evidence kon niet worden bewaard.");

  const { error: objError } = await admin
    .from("mission_objectives")
    .update({
      status: "COMPLETED",
      evidence_id: evidence.id,
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", objectiveId);
  if (objError) throw objError;

  const { error: missionError } = await admin
    .from("missions")
    .update({
      xp_granted: result.xpGrantedTotal,
      status: result.missionStatus,
      completed_at: result.completed ? new Date().toISOString() : null,
    } as never)
    .eq("id", loaded.row.id);
  if (missionError) throw missionError;

  await applyPlayerReward(playerId, result.xpDelta, result.statDelta);

  const mission = (await loadMission(playerId, loaded.row.id)).mission;
  const label = mission.objectives.find((objective) => objective.id === objectiveId)?.label ?? "objectief";
  return {
    mission,
    xpDelta: result.xpDelta,
    message: result.completed
      ? `Missie voltooid · +${result.xpDelta} XP`
      : `Objectief afgevinkt · ${label}`,
  };
}

async function finalizeAndPersist(
  playerId: string,
  loaded: { row: MissionRow; objectives: ObjectiveRow[]; mission: PublicMission },
) {
  const rewardState: RewardMission = {
    kind: loaded.row.kind,
    status: loaded.row.status,
    xpReward: loaded.row.xp_reward,
    xpGranted: loaded.row.xp_granted,
    statReward: { key: loaded.row.stat_reward_key, amount: loaded.row.stat_reward_amount },
    objectives: loaded.mission.objectives.map((objective) => ({
      id: objective.id,
      optional: objective.optional,
      status: objective.status,
    })),
  };
  const result = finalizeMission(rewardState);
  const admin = createSupabaseAdminClient();
  const { error: missionError } = await admin
    .from("missions")
    .update({
      xp_granted: result.xpGrantedTotal,
      status: result.missionStatus,
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", loaded.row.id);
  if (missionError) throw missionError;
  await applyPlayerReward(playerId, result.xpDelta, result.statDelta);
  const mission = (await loadMission(playerId, loaded.row.id)).mission;
  return { mission, xpDelta: result.xpDelta, message: `Missie voltooid · +${result.xpDelta} XP` };
}

async function applyPlayerReward(
  playerId: string,
  xpDelta: number,
  statDelta: { key: string; amount: number } | null,
) {
  if (xpDelta <= 0 && !statDelta) return;
  const admin = createSupabaseAdminClient();
  const { data: player, error: playerError } = await admin
    .from("players")
    .select("xp, xp_to_next, level, lifetime_xp")
    .eq("id", playerId)
    .single();
  if (playerError || !player) throw playerError ?? new Error("Speler niet gevonden.");
  const nextPlayer = applyXpToPlayer(
    {
      xp: player.xp as number,
      xpToNext: player.xp_to_next as number,
      level: player.level as number,
      lifetimeXp: player.lifetime_xp as number,
    },
    xpDelta,
  );
  const { error: xpError } = await admin
    .from("players")
    .update({
      xp: nextPlayer.xp,
      level: nextPlayer.level,
      lifetime_xp: nextPlayer.lifetimeXp,
    } as never)
    .eq("id", playerId);
  if (xpError) throw xpError;
  if (!statDelta) return;
  const { data: stat } = await admin
    .from("stat_values")
    .select("id, value")
    .eq("player_id", playerId)
    .eq("key", statDelta.key)
    .is("deleted_at", null)
    .maybeSingle();
  if (stat) {
    const value = Math.max(0, Math.min(100, (stat.value as number) + statDelta.amount));
    await admin.from("stat_values").update({ value } as never).eq("id", stat.id);
  }
}

export { RestrictedContactError, MissionClosedError, MissionLockedError };
export type { PublicObjective };
