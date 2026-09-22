import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { listMedia } from "@/server/domain/media/repository";
import { listMemories } from "@/server/domain/memory/repository";
import { listAllMissionsForAdmin } from "@/server/domain/mission/repository";
import { listExitCriteria } from "@/server/domain/campaign/chapterRepository";
import { getCampaignRecord } from "@/server/domain/campaign/review";
import { getNotificationBudget } from "@/server/domain/notify/repository";
import { listAllOpportunities } from "@/server/domain/opportunity/repository";
import { listPatterns } from "@/server/domain/pattern/repository";
import { listProposals, type PublicProposal } from "@/server/domain/nyx/proposalRepository";
import { isMemoryPayload } from "@/server/domain/nyx/proposalTypes";
import { getActivePersona } from "@/server/domain/persona/repository";
import { NYX_CORE, NYX_CORE_VERSION } from "@/server/ai/prompts/nyx-core";
import { DEFAULT_PERSONA } from "@/server/ai/prompts/persona";
import type { SessionPlayer } from "@/server/domain/player/types";
import {
  getMediaBudget,
  mediaBudgetRemaining,
  type MediaBudgetRemaining,
  type NyxMediaBudget,
} from "@/server/domain/nyx/relationship/mediaBudget";
import {
  getRelationshipDirection,
  type RelationshipDirection,
} from "@/server/domain/nyx/relationship/direction";
import {
  latestRelationshipSnapshot,
  listRelationshipSnapshots,
  type RelationshipSnapshot,
} from "@/server/domain/nyx/relationship/repository";

export type AdminRun = {
  id: string;
  service: string;
  taskType: string;
  model: string;
  modelTier: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  status: string;
  error: string | null;
  createdAt: string;
  contextRefs: string[];
};

export type AdminKpi = {
  runs7d: number;
  costCents7d: number;
  p95: number;
  errorRate: number;
  pending: number;
  interruptsWeek: number;
  interruptBudget: number;
  memoryRate: number;
  rejectRate: number;
};

function asRun(row: Record<string, unknown>): AdminRun {
  return {
    id: row.id as string,
    service: (row.service as string) ?? "ORCHESTRATOR",
    taskType: (row.task_type as string) ?? "",
    model: (row.model as string) ?? "",
    modelTier: (row.model_tier as string) ?? "",
    promptVersion: (row.prompt_version as string) ?? "",
    inputTokens: Number(row.input_tokens ?? 0),
    outputTokens: Number(row.output_tokens ?? 0),
    latencyMs: Number(row.latency_ms ?? 0),
    costCents: Number(row.cost_cents ?? row.estimated_cost_cents ?? 0),
    status: (row.status as string) ?? "OK",
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    contextRefs: Array.isArray(row.context_refs) ? (row.context_refs as string[]) : [],
  };
}

export async function listAdminRuns(playerId: string): Promise<AdminRun[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_runs")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []).map((row) => asRun(row as Record<string, unknown>));
}

export async function loadOverview(player: SessionPlayer) {
  const [runs, proposals, budget, memories] = await Promise.all([
    listAdminRuns(player.id),
    listProposals(player.id),
    getNotificationBudget(player.id),
    listMemories(player.id),
  ]);

  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = runs.filter((run) => new Date(run.createdAt).getTime() >= weekAgo);
  const errors = week.filter((run) => run.status !== "OK").length;
  const latencies = week.map((run) => run.latencyMs).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.floor((latencies.length - 1) * 0.95)] ?? 0 : 0;
  const decided = proposals.filter((item) => item.status === "APPROVED" || item.status === "REJECTED");
  const rejected = decided.filter((item) => item.status === "REJECTED").length;

  const kpi: AdminKpi = {
    runs7d: week.length,
    costCents7d: week.reduce((sum, run) => sum + run.costCents, 0),
    p95,
    errorRate: week.length ? Math.round((errors / week.length) * 1000) / 10 : 0,
    pending: proposals.filter((item) => item.status === "PENDING").length,
    interruptsWeek: budget.usedThisWeek,
    interruptBudget: budget.usedThisWeek + budget.remainingWeek,
    memoryRate: memories.length ? Math.min(1, memories.filter((item) => item.sourceType === "CHAT").length / Math.max(1, week.length)) : 0,
    rejectRate: decided.length ? rejected / decided.length : 0,
  };

  const byDay = new Map<string, { runs: number; cents: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    byDay.set(day.toISOString().slice(0, 10), { runs: 0, cents: 0 });
  }
  for (const run of runs) {
    const key = run.createdAt.slice(0, 10);
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.runs += 1;
    bucket.cents += run.costCents;
  }

  return {
    kpi,
    runsSeries: [...byDay.values()].map((item) => item.runs),
    costSeries: [...byDay.values()].map((item) => item.cents),
    proposals,
  };
}

export async function loadProposalsPage(player: SessionPlayer) {
  return listProposals(player.id);
}

export type AdminMemoryRow = {
  memory: Awaited<ReturnType<typeof listMemories>>[number];
  versions: { at: string; by: string; reason: string }[];
};

export async function loadMemoryPage(player: SessionPlayer): Promise<{
  rows: AdminMemoryRow[];
  memoryProposals: PublicProposal[];
  loadError: string | null;
  totalMemories: number;
}> {
  let memories: Awaited<ReturnType<typeof listMemories>>;
  try {
    memories = await listMemories(player.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Memories laden mislukt.";
    const hint = /memories|schema cache|PGRST/i.test(message)
      ? " Controleer of migratie phase8_memory op Supabase is gedraaid."
      : "";
    return { rows: [], memoryProposals: [], loadError: `${message}${hint}`, totalMemories: 0 };
  }

  let memoryProposals: PublicProposal[] = [];
  try {
    const proposals = await listProposals(player.id);
    memoryProposals = proposals.filter(
      (item) =>
        (item.kind === "MEMORY" || item.kind === "MEMORY_REVISION") &&
        isMemoryPayload(item.payload),
    );
  } catch {
    memoryProposals = [];
  }

  const versions = new Map<string, { at: string; by: string; reason: string }[]>();
  const ids = memories.map((item) => item.id);
  if (ids.length) {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("memory_versions")
        .select("memory_id, changed_by, reason, created_at")
        .in("memory_id", ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      for (const row of data ?? []) {
        const id = row.memory_id as string;
        const list = versions.get(id) ?? [];
        list.push({
          at: row.created_at as string,
          by: row.changed_by as string,
          reason: (row.reason as string) ?? "",
        });
        versions.set(id, list);
      }
    } catch {
      // Version history is optional for the inspector — still list memories.
    }
  }

  const sorted = [...memories].sort((a, b) => {
    const rank = (status: string) => (status === "ACTIVE" ? 0 : 1);
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return new Date(b.lastObservedAt).getTime() - new Date(a.lastObservedAt).getTime();
  });
  const capped = sorted.slice(0, 200);

  return {
    rows: capped.map((memory) => ({ memory, versions: versions.get(memory.id) ?? [] })),
    memoryProposals,
    loadError: null,
    totalMemories: memories.length,
  };
}

export async function loadPatternsPage(player: SessionPlayer) {
  return listPatterns(player.id);
}

export async function loadRadarPage(player: SessionPlayer) {
  return listAllOpportunities(player.id);
}

export async function loadCampaignPage(player: SessionPlayer) {
  const [campaign, missions, record] = await Promise.all([
    findPublicCampaignByPlayerId(player.id),
    listAllMissionsForAdmin(player.id),
    getCampaignRecord(player.id),
  ]);
  const counts: Record<string, number> = {};
  for (const mission of missions) {
    counts[mission.status] = (counts[mission.status] ?? 0) + 1;
  }
  const chapterId = record?.chapter?.id ?? null;
  const exitCriteria = chapterId ? await listExitCriteria(chapterId).catch(() => []) : [];
  const chapterDetail = record?.chapter
    ? {
        strategicPurpose: record.chapter.strategic_purpose,
        skeleton: record.chapter.skeleton,
        exitCriteria,
        lockedFields: record.chapter.locked_fields ?? [],
      }
    : null;
  return { campaign, missions, counts, stats: player.stats, chapterDetail };
}

export async function loadPromptsPage() {
  const active = await getActivePersona().catch(() => null);
  return {
    version: active ? `persona@${active.version}` : NYX_CORE_VERSION,
    compiled: active?.compiledPrompt || NYX_CORE,
    persona: DEFAULT_PERSONA,
  };
}

export async function loadAssetsPage(player: SessionPlayer) {
  return listMedia(player.id);
}

export async function loadNyxRelationshipPage(player: SessionPlayer): Promise<{
  latest: RelationshipSnapshot | null;
  history: RelationshipSnapshot[];
  budget: NyxMediaBudget;
  usage: MediaBudgetRemaining | null;
  direction: RelationshipDirection;
  loadError: string | null;
}> {
  try {
    const [latest, history, budget, usage, direction] = await Promise.all([
      latestRelationshipSnapshot(player.id),
      listRelationshipSnapshots(player.id, 12),
      getMediaBudget(player.id),
      mediaBudgetRemaining(player.id).catch(() => null),
      getRelationshipDirection(player.id),
    ]);
    return { latest, history, budget, usage, direction, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relatiepagina laden mislukt.";
    const hint = /nyx_relationship|nyx_media_budget|schema cache|PGRST/i.test(message)
      ? " Controleer of migratie 20260921120000_nyx_relationship (en 20260922150000 scenario's) op Supabase is gedraaid."
      : "";
    return {
      latest: null,
      history: [],
      budget: { maxPhotosPerDay: 2, maxVideosPerDay: 1 },
      usage: null,
      direction: {
        mode: "natural",
        scenarioId: null,
        scenarioTitle: null,
        scenarioSummary: null,
        sourceSnapshotId: null,
        updatedAt: null,
      },
      loadError: `${message}${hint}`,
    };
  }
}

export async function pendingCount(playerId: string) {
  const proposals = await listProposals(playerId);
  return proposals.filter((item) => item.status === "PENDING").length;
}
