import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MemoryProposalPayload } from "@/server/domain/memory/types";
import { insertMemory, supersedeMemory } from "@/server/domain/memory/repository";
import {
  isMemoryPayload,
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
  const payload =
    kind === "MEMORY" || kind === "MEMORY_REVISION" ? asMemoryPayload(row.payload) : asSideQuestPayload(row.payload);
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
