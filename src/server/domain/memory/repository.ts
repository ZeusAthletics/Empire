import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Memory,
  MemoryChangedBy,
  MemoryChip,
  MemoryConfidence,
  MemoryDomain,
  MemoryDraft,
  MemoryImportance,
  MemorySourceType,
  MemoryStatus,
} from "@/server/domain/memory/types";
import { retrieveRelevantMemoriesFrom } from "@/server/domain/memory/retrieval";

const CONFIDENCE = new Set<MemoryConfidence>(["TENTATIVE", "LIKELY", "CONFIRMED", "EXPLICIT"]);
const IMPORTANCE = new Set<MemoryImportance>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const DOMAINS = new Set<MemoryDomain>([
  "PERSONAL",
  "CAMPAIGN",
  "STRATEGIC",
  "RELATIONSHIP",
  "PREFERENCE",
  "CONVERSATION_SUMMARY",
]);
const STATUSES = new Set<MemoryStatus>(["ACTIVE", "SUPERSEDED", "REJECTED", "ARCHIVED"]);
const SOURCES = new Set<MemorySourceType>(["CHAT", "JOURNAL", "MISSION", "MANUAL", "IMPORT"]);

function asEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return allowed.has(value as T) ? (value as T) : fallback;
}

export function mapMemory(row: Record<string, unknown>): Memory {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    seedKey: (row.seed_key as string | null) ?? null,
    domain: asEnum(row.domain, DOMAINS, "PERSONAL"),
    category: (row.category as string) ?? "",
    content: (row.content as string) ?? "",
    normalizedFact: (row.normalized_fact as string) ?? "",
    confidence: asEnum(row.confidence, CONFIDENCE, "TENTATIVE"),
    importance: asEnum(row.importance, IMPORTANCE, "MEDIUM"),
    status: asEnum(row.status, STATUSES, "ACTIVE"),
    sourceType: asEnum(row.source_type, SOURCES, "CHAT"),
    sourceId: (row.source_id as string | null) ?? null,
    observationCount: Number(row.observation_count ?? 1),
    firstObservedAt: row.first_observed_at as string,
    lastObservedAt: row.last_observed_at as string,
    lastReferencedAt: (row.last_referenced_at as string | null) ?? null,
    userConfirmed: Boolean(row.user_confirmed),
    supersedesMemoryId: (row.supersedes_memory_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function snapshotOf(memory: Memory) {
  return {
    playerId: memory.playerId,
    seedKey: memory.seedKey,
    domain: memory.domain,
    category: memory.category,
    content: memory.content,
    normalizedFact: memory.normalizedFact,
    confidence: memory.confidence,
    importance: memory.importance,
    status: memory.status,
    sourceType: memory.sourceType,
    sourceId: memory.sourceId,
    observationCount: memory.observationCount,
    firstObservedAt: memory.firstObservedAt,
    lastObservedAt: memory.lastObservedAt,
    lastReferencedAt: memory.lastReferencedAt,
    userConfirmed: memory.userConfirmed,
    supersedesMemoryId: memory.supersedesMemoryId,
  };
}

async function appendVersion(memory: Memory, changedBy: MemoryChangedBy, reason: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("memory_versions").insert({
    memory_id: memory.id,
    snapshot: snapshotOf(memory),
    changed_by: changedBy,
    reason,
  } as never);
  if (error) throw error;
}

async function loadMemory(playerId: string, memoryId: string): Promise<Memory> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("memories")
    .select("*")
    .eq("player_id", playerId)
    .eq("id", memoryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Herinnering niet gevonden.");
  return mapMemory(data as Record<string, unknown>);
}

export async function listMemories(playerId: string): Promise<Memory[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("memories")
    .select("*")
    .eq("player_id", playerId)
    .order("last_observed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapMemory(row as Record<string, unknown>));
}

export async function listActiveMemories(playerId: string): Promise<Memory[]> {
  const memories = await listMemories(playerId);
  return memories.filter((memory) => memory.status === "ACTIVE");
}

export async function retrieveRelevantMemories(playerId: string, query = ""): Promise<Memory[]> {
  const memories = await listMemories(playerId);
  const picked = retrieveRelevantMemoriesFrom(memories, query);
  if (!picked.length) return [];
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("memories")
    .update({ last_referenced_at: now } as never)
    .in(
      "id",
      picked.map((memory) => memory.id),
    );
  return picked;
}

export async function insertMemory(
  playerId: string,
  draft: MemoryDraft,
  changedBy: MemoryChangedBy,
  reason: string,
): Promise<Memory> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("memories")
    .insert({
      player_id: playerId,
      seed_key: draft.seedKey ?? null,
      domain: draft.domain,
      category: draft.category,
      content: draft.content,
      normalized_fact: draft.normalizedFact,
      confidence: draft.confidence,
      importance: draft.importance,
      status: "ACTIVE",
      source_type: draft.sourceType,
      source_id: draft.sourceId ?? null,
      observation_count: 1,
      first_observed_at: now,
      last_observed_at: now,
      user_confirmed: Boolean(draft.userConfirmed),
      supersedes_memory_id: draft.supersedesMemoryId ?? null,
    } as never)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Herinnering kon niet worden bewaard.");
  const memory = mapMemory(data as Record<string, unknown>);
  await appendVersion(memory, changedBy, reason);
  return memory;
}

export async function bumpObservation(playerId: string, memoryId: string): Promise<Memory> {
  const current = await loadMemory(playerId, memoryId);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const nextConfidence =
    current.confidence === "TENTATIVE" ? "LIKELY" : current.confidence === "LIKELY" ? "CONFIRMED" : current.confidence;
  const { data, error } = await admin
    .from("memories")
    .update({
      observation_count: current.observationCount + 1,
      last_observed_at: now,
      confidence: nextConfidence,
    } as never)
    .eq("id", memoryId)
    .eq("player_id", playerId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Observatie kon niet worden bijgewerkt.");
  const memory = mapMemory(data as Record<string, unknown>);
  await appendVersion(memory, "SYSTEM", "Opnieuw waargenomen.");
  return memory;
}

export async function supersedeMemory(
  playerId: string,
  memoryId: string,
  draft: MemoryDraft,
): Promise<Memory> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("memories")
    .update({ status: "SUPERSEDED" } as never)
    .eq("id", memoryId)
    .eq("player_id", playerId)
    .eq("status", "ACTIVE");
  if (error) throw error;
  const old = await loadMemory(playerId, memoryId);
  await appendVersion(old, "USER", "Vervangen door een nieuw feit.");
  return insertMemory(
    playerId,
    { ...draft, supersedesMemoryId: memoryId, userConfirmed: true },
    "USER",
    "Goedgekeurde revisie.",
  );
}

export async function rejectStoredMemory(playerId: string, memoryId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("memories")
    .update({ status: "REJECTED" } as never)
    .eq("id", memoryId)
    .eq("player_id", playerId);
  if (error) throw error;
  const memory = await loadMemory(playerId, memoryId);
  await appendVersion(memory, "USER", "Afgewezen. Blijft buiten latere context.");
}

export function chipFromProposal(id: string, fact: string, content: string): MemoryChip {
  const label = (content || fact).trim().slice(0, 42);
  return { id, label, fact };
}
