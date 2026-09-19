import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CampaignReviewPayload } from "@/server/ai/schemas/campaign-review.schema";
import type { MemoryProposalPayload } from "@/server/domain/memory/types";
import { insertMemory, supersedeMemory } from "@/server/domain/memory/repository";
import { applyCampaignReview } from "@/server/domain/campaign/review";
import { confirmPattern, dismissPattern } from "@/server/domain/pattern/repository";
import type { PatternProposalPayload } from "@/server/domain/pattern/types";
import {
  isMemoryPayload,
  isPatternPayload,
  isReviewPayload,
  isSideQuestPayload,
  type PublicProposal,
  type SideQuestProposalPayload,
} from "@/server/domain/nyx/proposalTypes";
import { createMissionFromProposal } from "@/server/domain/nyx/createMissionFromProposal";
import type { PublicMission } from "@/server/domain/mission/types";

export type { PublicProposal, SideQuestProposalPayload };

function asSideQuestPayload(value: unknown): SideQuestProposalPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as SideQuestProposalPayload;
  if (!row.title || !row.blueprint) return null;
  return row;
}

function asMemoryPayload(value: unknown): MemoryProposalPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as MemoryProposalPayload;
  if (!row.normalizedFact || !row.domain) return null;
  return row;
}

function mapProposal(row: Record<string, unknown>): PublicProposal | null {
  const kind = row.kind as string;
  const raw = row.payload;
  const payload =
    kind === "MEMORY" || kind === "MEMORY_REVISION"
      ? asMemoryPayload(raw)
      : kind === "SIDE_QUEST"
        ? asSideQuestPayload(raw)
        : raw && typeof raw === "object"
          ? (raw as PublicProposal["payload"])
          : null;
  if (!payload) return null;
  return {
    id: row.id as string,
    seedKey: (row.seed_key as string | null) ?? null,
    kind,
    status: row.status as string,
    rationale: row.rationale as string,
    payload,
  };
}

export async function listPendingSideQuest(playerId: string): Promise<PublicProposal | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("proposals")
    .select("id, seed_key, kind, status, rationale, payload")
    .eq("player_id", playerId)
    .eq("kind", "SIDE_QUEST")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapProposal(data as Record<string, unknown>);
}

export async function listPendingMemoryProposals(playerId: string): Promise<PublicProposal[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("proposals")
    .select("id, seed_key, kind, status, rationale, payload")
    .eq("player_id", playerId)
    .in("kind", ["MEMORY", "MEMORY_REVISION"])
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(3);
  if (error) throw error;
  return (data ?? [])
    .map((row) => mapProposal(row as Record<string, unknown>))
    .filter((item): item is PublicProposal => Boolean(item));
}

export async function getProposal(playerId: string, proposalId: string): Promise<PublicProposal> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("proposals")
    .select("id, seed_key, kind, status, rationale, payload")
    .eq("player_id", playerId)
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw error;
  const mapped = data ? mapProposal(data as Record<string, unknown>) : null;
  if (!mapped) throw new Error("Voorstel niet gevonden.");
  return mapped;
}

export async function createMemoryProposal(playerId: string, payload: MemoryProposalPayload): Promise<void> {
  const seedKey = `mem:${payload.normalizedFact}`;
  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("proposals")
    .select("id, status")
    .eq("player_id", playerId)
    .eq("seed_key", seedKey)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const pending = await listPendingMemoryProposals(playerId);
  if (pending.some((item) => isMemoryPayload(item.payload) && item.payload.normalizedFact === payload.normalizedFact)) {
    return;
  }

  const kind = payload.supersedesMemoryId ? "MEMORY_REVISION" : "MEMORY";
  const { error } = await admin.from("proposals").insert({
    player_id: playerId,
    seed_key: seedKey,
    kind,
    payload,
    rationale: payload.content,
    confidence: payload.confidence,
    importance: payload.importance,
    status: "PENDING",
  } as never);
  if (error) throw error;
}

export async function rejectProposal(playerId: string, proposalId: string): Promise<void> {
  const proposal = await getProposal(playerId, proposalId);
  if (proposal.status !== "PENDING") throw new Error("Dit voorstel is al afgehandeld.");
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({
      status: "REJECTED",
      decided_by: "USER",
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", proposalId)
    .eq("player_id", playerId);
  if (error) throw error;
}

export async function approveProposal(
  playerId: string,
  proposalId: string,
  edits?: { title?: string; xp?: number },
): Promise<PublicMission> {
  const proposal = await getProposal(playerId, proposalId);
  if (proposal.status !== "PENDING") throw new Error("Dit voorstel is al afgehandeld.");
  if (!isSideQuestPayload(proposal.payload)) throw new Error("Dit is geen missievoorstel.");
  if (edits?.title) proposal.payload.title = edits.title.trim().toUpperCase();
  if (typeof edits?.xp === "number" && edits.xp > 0) proposal.payload.xp = Math.round(edits.xp);

  const mission = await createMissionFromProposal(playerId, proposalId, proposal.payload);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({
      payload: proposal.payload,
      status: "APPROVED",
      decided_by: "USER",
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", proposalId)
    .eq("player_id", playerId);
  if (error) throw error;
  return mission;
}

export async function approveMemoryProposal(playerId: string, proposalId: string) {
  const proposal = await getProposal(playerId, proposalId);
  if (proposal.status !== "PENDING") throw new Error("Dit voorstel is al afgehandeld.");
  if (!isMemoryPayload(proposal.payload)) throw new Error("Dit is geen geheugenvoorstel.");

  const draft = {
    domain: proposal.payload.domain,
    category: proposal.payload.category,
    content: proposal.payload.content,
    normalizedFact: proposal.payload.normalizedFact,
    confidence: proposal.payload.confidence,
    importance: proposal.payload.importance,
    sourceType: proposal.payload.sourceType,
    sourceId: proposal.payload.sourceId ?? null,
    userConfirmed: true,
    supersedesMemoryId: proposal.payload.supersedesMemoryId ?? null,
  };

  const memory = proposal.payload.supersedesMemoryId
    ? await supersedeMemory(playerId, proposal.payload.supersedesMemoryId, draft)
    : await insertMemory(playerId, draft, "USER", "Onthouden.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({
      status: "APPROVED",
      decided_by: "USER",
      decided_at: new Date().toISOString(),
    } as never)
    .eq("id", proposalId)
    .eq("player_id", playerId);
  if (error) throw error;
  return memory;
}

async function insertKindedProposal(
  playerId: string,
  input: {
    seedKey: string;
    kind: string;
    payload: unknown;
    rationale: string;
    confidence?: string;
    importance?: string;
  },
) {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("proposals")
    .select("id, status")
    .eq("player_id", playerId)
    .eq("seed_key", input.seedKey)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return;

  const { error } = await admin.from("proposals").insert({
    player_id: playerId,
    seed_key: input.seedKey,
    kind: input.kind,
    payload: input.payload,
    rationale: input.rationale,
    confidence: input.confidence ?? "LIKELY",
    importance: input.importance ?? "HIGH",
    status: "PENDING",
  } as never);
  if (error) throw error;
}

export async function listPendingByKind(playerId: string, kind: string): Promise<PublicProposal | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("proposals")
    .select("id, seed_key, kind, status, rationale, payload")
    .eq("player_id", playerId)
    .eq("kind", kind)
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapProposal(data as Record<string, unknown>);
}

export async function createPatternProposal(playerId: string, payload: PatternProposalPayload) {
  await insertKindedProposal(playerId, {
    seedKey: `pat:${payload.patternId ?? payload.title}`,
    kind: "PATTERN",
    payload,
    rationale: payload.description,
    importance: payload.strategicImpact,
  });
}

export async function createCampaignReviewProposal(playerId: string, payload: CampaignReviewPayload, rationale: string) {
  await insertKindedProposal(playerId, {
    seedKey: `rev:${payload.proposedBottleneck ?? "keep"}:${payload.currentChapterId ?? "none"}`,
    kind: "CAMPAIGN_REVIEW",
    payload,
    rationale,
    importance: "HIGH",
  });
}

export async function createMainQuestProposal(playerId: string, payload: Record<string, unknown>, rationale: string) {
  await insertKindedProposal(playerId, {
    seedKey: `mq:${String(payload.title ?? rationale).slice(0, 40)}`,
    kind: "MAIN_QUEST_CHANGE",
    payload,
    rationale,
    importance: "HIGH",
  });
}

export async function approvePatternProposal(playerId: string, proposalId: string) {
  const proposal = await getProposal(playerId, proposalId);
  if (proposal.status !== "PENDING") throw new Error("Dit voorstel is al afgehandeld.");
  if (!isPatternPayload(proposal.payload)) throw new Error("Dit is geen patroonvoorstel.");
  if (proposal.payload.patternId) {
    await confirmPattern(playerId, proposal.payload.patternId);
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({ status: "APPROVED", decided_by: "USER", decided_at: new Date().toISOString() } as never)
    .eq("id", proposalId)
    .eq("player_id", playerId);
  if (error) throw error;
  return proposal.payload;
}

export async function rejectPatternProposal(playerId: string, proposalId: string) {
  const proposal = await getProposal(playerId, proposalId);
  if (isPatternPayload(proposal.payload) && proposal.payload.patternId) {
    await dismissPattern(playerId, proposal.payload.patternId);
  }
  await rejectProposal(playerId, proposalId);
}

export async function approveCampaignReviewProposal(playerId: string, proposalId: string) {
  const proposal = await getProposal(playerId, proposalId);
  if (proposal.status !== "PENDING") throw new Error("Dit voorstel is al afgehandeld.");
  if (!isReviewPayload(proposal.payload)) throw new Error("Dit is geen campagne-review.");
  const applied = await applyCampaignReview(playerId, proposal.payload);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({ status: "APPROVED", decided_by: "USER", decided_at: new Date().toISOString() } as never)
    .eq("id", proposalId)
    .eq("player_id", playerId);
  if (error) throw error;
  return applied;
}
