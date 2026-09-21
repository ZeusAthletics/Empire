import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ChapterSkeletonPlan } from "@/server/ai/schemas/chapter-skeleton.schema";
import { asStatKeys, normalizeExitComparator } from "@/server/ai/schemas/chapter-skeleton.schema";
import type {
  ChapterExitCriterionRow,
  ChapterRow,
  ExitComparator,
  ExitCriterionKind,
} from "@/server/domain/campaign/types";
import type { StatKey } from "@/server/domain/player/types";
import { STAT_KEYS } from "@/server/domain/player/types";

function criterionStatKey(kind: ExitCriterionKind, raw: string | null): StatKey | null {
  if (kind !== "STAT" || !raw?.trim()) return null;
  const key = raw.trim().toLowerCase() as StatKey;
  return STAT_KEYS.includes(key) ? key : null;
}

export async function listExitCriteria(chapterId: string): Promise<ChapterExitCriterionRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("chapter_exit_criteria")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChapterExitCriterionRow[];
}

export async function replaceExitCriteriaFromPlan(
  playerId: string,
  chapterId: string,
  plan: ChapterSkeletonPlan,
  lockedByAdmin: boolean,
): Promise<void> {
  if (lockedByAdmin) return;

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("chapter_exit_criteria")
    .select("id, locked_by_admin")
    .eq("chapter_id", chapterId);
  const lockedIds = new Set(
    (existing ?? []).filter((row) => row.locked_by_admin).map((row) => row.id as string),
  );

  await admin.from("chapter_exit_criteria").delete().eq("chapter_id", chapterId).eq("locked_by_admin", false);

  const rows = plan.exitCriteria.map((item, index) => ({
    chapter_id: chapterId,
    player_id: playerId,
    label: item.label,
    kind: item.kind as ExitCriterionKind,
    stat_key: criterionStatKey(item.kind as ExitCriterionKind, item.statKey),
    comparator:
      item.kind === "MANUAL"
        ? null
        : normalizeExitComparator(item.comparator) ?? ("GTE" as ExitComparator),
    target_value: item.targetValue,
    status: "OPEN" as const,
    sort_order: index,
    locked_by_admin: false,
  }));

  if (rows.length) {
    const { error } = await admin.from("chapter_exit_criteria").insert(rows as never);
    if (error) throw error;
  }

  if (lockedIds.size) {
    // locked rows were preserved by delete filter; no action needed
  }
}

export async function applySkeletonPlan(
  chapter: ChapterRow,
  plan: ChapterSkeletonPlan,
): Promise<ChapterRow> {
  const admin = createSupabaseAdminClient();
  const locked = new Set(chapter.locked_fields ?? []);
  const patch: Record<string, unknown> = {};

  if (!locked.has("strategic_purpose")) patch.strategic_purpose = plan.strategicPurpose;
  if (!locked.has("subtitle")) patch.subtitle = plan.subtitle;
  if (!locked.has("start_conditions")) patch.start_conditions = plan.startConditions;
  if (!locked.has("desired_state")) patch.desired_state = plan.desiredState;
  if (!locked.has("dependencies")) patch.dependencies = plan.dependencies;
  if (!locked.has("related_stats")) patch.related_stats = asStatKeys(plan.relatedStats);
  if (!locked.has("strategic_risks")) patch.strategic_risks = plan.strategicRisks;
  if (!locked.has("assumptions")) patch.assumptions = plan.assumptions;
  if (!locked.has("skeleton")) patch.skeleton = plan;
  if (!locked.has("economic_from")) patch.economic_from = Math.round(plan.economicFrom);
  if (!locked.has("economic_to")) patch.economic_to = Math.max(Math.round(plan.economicTo), Math.round(plan.economicFrom) + 1);
  if (!locked.has("exit_criteria")) {
    patch.exit_criteria = plan.exitCriteria.map((c) => c.label);
  }

  if (Object.keys(patch).length === 0) return chapter;

  const { data, error } = await admin
    .from("chapters")
    .update(patch as never)
    .eq("id", chapter.id)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Hoofdstuk kon niet worden bijgewerkt.");
  return data as ChapterRow;
}

export async function markCriteriaMet(criterionIds: string[]): Promise<void> {
  if (!criterionIds.length) return;
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("chapter_exit_criteria")
    .update({ status: "MET", met_at: now } as never)
    .in("id", criterionIds);
  if (error) throw error;
}

export async function completeChapter(chapterId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("chapters")
    .update({ status: "COMPLETED", closed_at: now } as never)
    .eq("id", chapterId);
  if (error) throw error;
}

export async function activateChapter(chapterId: string, campaignId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error: chapterError } = await admin
    .from("chapters")
    .update({ status: "ACTIVE", opened_at: now } as never)
    .eq("id", chapterId);
  if (chapterError) throw chapterError;
  const { error: campaignError } = await admin
    .from("campaigns")
    .update({ current_chapter_id: chapterId } as never)
    .eq("id", campaignId);
  if (campaignError) throw campaignError;
}

export async function insertNextChapterPlaceholder(
  playerId: string,
  campaignId: string,
  index: number,
  roman: string,
  name: string,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("chapters")
    .insert({
      campaign_id: campaignId,
      player_id: playerId,
      index,
      roman,
      name,
      tagline: "Nyx plant dit hoofdstuk.",
      status: "LOCKED",
      source: "AI",
    } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Hoofdstuk kon niet worden aangemaakt.");
  return data.id as string;
}
