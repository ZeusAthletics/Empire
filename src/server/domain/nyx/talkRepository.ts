import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { activeMissionsForNyx } from "@/server/domain/mission/nyxContext";
import { featuredMission } from "@/server/domain/mission/types";
import { listMissions } from "@/server/domain/mission/repository";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { findPlayerById } from "@/server/domain/player/repository";
import { NYX_GREETING } from "@/server/ai/fallback/nyxReply";
import type { NyxChatMessage, NyxTalkState } from "@/server/domain/nyx/types";
import { chipFromProposal } from "@/server/domain/memory/repository";
import { companionConversationId } from "@/server/domain/nyx/companionRepository";
import { isVideoStoragePath } from "@/server/domain/media/contentType";
import { publicMediaUrl } from "@/server/domain/media/repository";
import { isMemoryPayload, isSideQuestPayload } from "@/server/domain/nyx/proposalTypes";
import {
  listPendingByKind,
  listPendingMemoryProposals,
  listPendingSideQuest,
  type PublicProposal,
} from "@/server/domain/nyx/proposalRepository";
import { isPatternPayload, isReviewPayload } from "@/server/domain/nyx/proposalTypes";

async function mediaMetaForIds(ids: string[]): Promise<Map<string, { src: string; video: boolean }>> {
  const map = new Map<string, { src: string; video: boolean }>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return map;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("media_assets").select("id, approved, storage_path").in("id", unique);
  if (error || !data) return map;
  for (const row of data) {
    if (!row.approved) continue;
    const path = String(row.storage_path ?? "");
    map.set(row.id as string, {
      src: publicMediaUrl(row.id as string),
      video: isVideoStoragePath(path),
    });
  }
  return map;
}

async function mapMessages(
  rows: {
    id: string;
    role: string;
    content: string;
    media_id?: string | null;
    linked_url?: string | null;
  }[],
): Promise<NyxChatMessage[]> {
  const mediaIds = rows.map((row) => row.media_id).filter(Boolean) as string[];
  const coverMap = await mediaMetaForIds(mediaIds);
  const kindMap = new Map<string, { kind: string; storage_path: string }>();
  if (mediaIds.length) {
    const admin = createSupabaseAdminClient();
    const { data: kindRows } = await admin.from("media_assets").select("id, kind, storage_path").in("id", mediaIds);
    for (const row of kindRows ?? []) {
      kindMap.set(row.id as string, row as { kind: string; storage_path: string });
    }
  }

  return rows.map((row) => {
    const mediaId = row.media_id ?? null;
    const cover = mediaId ? coverMap.get(mediaId) : undefined;
    const mediaSrc = cover?.src ?? null;
    const asset = mediaId ? kindMap.get(mediaId) : undefined;
    const path = String(asset?.storage_path ?? "");
    const chatFile = asset?.kind === "CHAT_ATTACHMENT";
    let mediaKind: NyxChatMessage["mediaKind"] = null;
    if (mediaSrc) {
      if (cover?.video || isVideoStoragePath(path)) mediaKind = "video";
      else if (chatFile && !/\.(png|jpe?g|webp|gif)$/i.test(path)) mediaKind = "file";
      else mediaKind = "image";
    }
    return {
      id: row.id,
      role: row.role === "USER" ? "me" : "nyx",
      text: row.content,
      mediaSrc,
      mediaKind,
      linkedUrl: (row.linked_url as string | null) ?? null,
    };
  });
}

function cardOf(proposal: PublicProposal | null) {
  if (!proposal || !isSideQuestPayload(proposal.payload)) return null;
  return {
    id: proposal.id,
    title: proposal.payload.title,
    duration: proposal.payload.duration,
    difficulty: proposal.payload.difficulty,
    xp: proposal.payload.xp,
    impact: proposal.payload.impact,
  };
}

export async function featuredTalkContext(playerId: string) {
  const [missions, campaign, player] = await Promise.all([
    listMissions(playerId),
    findPublicCampaignByPlayerId(playerId),
    findPlayerById(playerId),
  ]);
  return {
    featuredTitle: featuredMission(missions)?.title ?? "uw actieve missie",
    activeMissions: activeMissionsForNyx(missions),
    network: player?.stats.find((stat) => stat.key === "network")?.value ?? 0,
    economicCurrent: campaign?.chapter?.economicCurrent ?? 0,
  };
}

/** Mission-control + companion thread ids used by the Nyx sheet (all non-deleted). */
export async function listDisplayedNyxConversationIds(playerId: string): Promise<{
  primaryId: string;
  conversationIds: string[];
}> {
  const admin = createSupabaseAdminClient();
  const { data: existing, error } = await admin
    .from("nyx_conversations")
    .select("id")
    .eq("player_id", playerId)
    .eq("mode", "MISSION_CONTROL")
    .is("deleted_at", null)
    .order("started_at", { ascending: false });
  if (error) throw error;

  let primaryId = existing?.[0]?.id as string | undefined;
  if (!primaryId) {
    const { data: created, error: createError } = await admin
      .from("nyx_conversations")
      .insert({ player_id: playerId, mode: "MISSION_CONTROL" } as never)
      .select("id")
      .single();
    if (createError || !created) throw createError ?? new Error("Gesprek kon niet starten.");
    primaryId = created.id as string;
    const { error: greetError } = await admin.from("nyx_messages").insert({
      conversation_id: primaryId,
      player_id: playerId,
      role: "NYX",
      content: NYX_GREETING,
      mode: "MISSION_CONTROL",
    } as never);
    if (greetError) throw greetError;
  }

  const mcIds = (existing ?? []).map((row) => row.id as string);
  if (!mcIds.includes(primaryId)) mcIds.unshift(primaryId);
  const companionId = await companionConversationId(playerId);
  const conversationIds = companionId && !mcIds.includes(companionId) ? [...mcIds, companionId] : mcIds;
  return { primaryId, conversationIds };
}

export async function getOrCreateTalk(playerId: string): Promise<NyxTalkState> {
  const admin = createSupabaseAdminClient();
  const { primaryId: conversationId, conversationIds } = await listDisplayedNyxConversationIds(playerId);

  const { data: rows, error: msgError } = await admin
    .from("nyx_messages")
    .select("id, role, content, media_id, linked_url, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });
  if (msgError) throw msgError;

  const [pending, memoryProposals, patternProposal, reviewProposal] = await Promise.all([
    listPendingSideQuest(playerId),
    listPendingMemoryProposals(playerId),
    listPendingByKind(playerId, "PATTERN"),
    listPendingByKind(playerId, "CAMPAIGN_REVIEW"),
  ]);
  return {
    conversationId,
    messages: await mapMessages(rows ?? []),
    proposal: cardOf(pending),
    memoryChips: memoryProposals.flatMap((item) => {
      if (!isMemoryPayload(item.payload)) return [];
      return [chipFromProposal(item.id, item.payload.normalizedFact, item.payload.content)];
    }),
    pattern:
      patternProposal && isPatternPayload(patternProposal.payload)
        ? {
            id: patternProposal.id,
            title: patternProposal.payload.title,
            description: patternProposal.payload.description,
          }
        : null,
    review:
      reviewProposal && isReviewPayload(reviewProposal.payload)
        ? {
            id: reviewProposal.id,
            bottleneck: reviewProposal.payload.proposedBottleneck ?? "ongewijzigd",
            whatStays: reviewProposal.payload.whatStays,
          }
        : null,
  };
}

export async function appendOutboundNyxMessage(input: {
  playerId: string;
  conversationId: string;
  content: string;
  mediaId?: string | null;
  mediaContext?: string | null;
  runId?: string | null;
}): Promise<{ id: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .insert({
      conversation_id: input.conversationId,
      player_id: input.playerId,
      role: "NYX",
      content: input.content,
      mode: "MISSION_CONTROL",
      media_id: input.mediaId ?? null,
      media_context: input.mediaContext?.trim() || null,
      run_id: input.runId ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Nyx bericht kon niet worden bewaard.");
  return { id: data.id as string };
}

export async function appendMessage(input: {
  playerId: string;
  conversationId: string;
  role: "USER" | "NYX";
  content: string;
  runId?: string | null;
  mediaId?: string | null;
  linkedUrl?: string | null;
  attachmentContext?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .insert({
      conversation_id: input.conversationId,
      player_id: input.playerId,
      role: input.role,
      content: input.content,
      mode: "MISSION_CONTROL",
      media_id: input.mediaId ?? null,
      linked_url: input.linkedUrl?.trim() || null,
      attachment_context: input.attachmentContext?.trim() || null,
      run_id: input.runId ?? null,
    } as never)
    .select("id, role, content")
    .single();
  if (error || !data) throw error ?? new Error("Bericht kon niet worden bewaard.");
  return data;
}

export async function recentMessageTexts(conversationId: string, limit = 12): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return [...(data ?? [])].reverse().map((row) => `${row.role}: ${row.content}`);
}

export type IntimateSessionState = {
  conversationId: string;
  active: boolean;
  startedAt: string | null;
  lastAt: string | null;
  nonIntimateStreak: number;
};

function emptyIntimateState(conversationId: string): IntimateSessionState {
  return {
    conversationId,
    active: false,
    startedAt: null,
    lastAt: null,
    nonIntimateStreak: 0,
  };
}

function isMissingIntimateColumnError(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    message.includes("intimate_session_active") ||
    message.includes("intimate_started_at") ||
    message.includes("intimate_last_at") ||
    message.includes("intimate_nonintimate_streak") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

export async function getIntimateSessionState(conversationId: string): Promise<IntimateSessionState> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_conversations")
    .select(
      "id, intimate_session_active, intimate_started_at, intimate_last_at, intimate_nonintimate_streak",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    if (isMissingIntimateColumnError(error)) return emptyIntimateState(conversationId);
    throw error;
  }
  return {
    conversationId,
    active: Boolean(data?.intimate_session_active),
    startedAt: (data?.intimate_started_at as string | null) ?? null,
    lastAt: (data?.intimate_last_at as string | null) ?? null,
    nonIntimateStreak: Number(data?.intimate_nonintimate_streak ?? 0),
  };
}

export async function setIntimateSessionState(
  conversationId: string,
  patch: {
    active: boolean;
    startedAt?: string | null;
    lastAt?: string | null;
    nonIntimateStreak?: number;
  },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const row: Record<string, unknown> = {
    intimate_session_active: patch.active,
    updated_at: new Date().toISOString(),
  };
  if (patch.startedAt !== undefined) row.intimate_started_at = patch.startedAt;
  if (patch.lastAt !== undefined) row.intimate_last_at = patch.lastAt;
  if (patch.nonIntimateStreak !== undefined) row.intimate_nonintimate_streak = patch.nonIntimateStreak;
  else if (patch.active) row.intimate_nonintimate_streak = 0;
  const { error } = await admin.from("nyx_conversations").update(row as never).eq("id", conversationId);
  if (error) {
    if (isMissingIntimateColumnError(error)) return;
    throw error;
  }
}

/** Recent USER+NYX turns since intimate_last_at window start (or last N). */
export async function recentIntimateTurnTexts(
  conversationId: string,
  sinceIso: string | null,
  limit = 24,
): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("nyx_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (sinceIso) query = query.gte("created_at", sinceIso);
  const { data, error } = await query;
  if (error) throw error;
  return [...(data ?? [])].reverse().map((row) => `${row.role}: ${row.content}`);
}
