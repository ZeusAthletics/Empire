import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { featuredMission } from "@/server/domain/mission/types";
import { listMissions } from "@/server/domain/mission/repository";
import { findPublicCampaignByPlayerId } from "@/server/domain/campaign/repository";
import { findPlayerById } from "@/server/domain/player/repository";
import { NYX_GREETING } from "@/server/ai/fallback/nyxReply";
import type { NyxChatMessage, NyxTalkState } from "@/server/domain/nyx/types";
import { chipFromProposal } from "@/server/domain/memory/repository";
import { companionConversationId } from "@/server/domain/nyx/companionRepository";
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
      video: /\.mp4$/i.test(path),
    });
  }
  return map;
}

async function mapMessages(
  rows: { id: string; role: string; content: string; media_id?: string | null }[],
): Promise<NyxChatMessage[]> {
  const mediaIds = rows.map((row) => row.media_id).filter(Boolean) as string[];
  const coverMap = await mediaMetaForIds(mediaIds);
  return rows.map((row) => {
    const mediaId = row.media_id ?? null;
    const cover = mediaId ? coverMap.get(mediaId) : undefined;
    const mediaSrc = cover?.src ?? null;
    return {
      id: row.id,
      role: row.role === "USER" ? "me" : "nyx",
      text: row.content,
      mediaSrc,
      mediaKind: mediaSrc ? (cover?.video ? "video" : "image") : null,
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
    network: player?.stats.find((stat) => stat.key === "network")?.value ?? 0,
    economicCurrent: campaign?.chapter?.economicCurrent ?? 0,
  };
}

export async function getOrCreateTalk(playerId: string): Promise<NyxTalkState> {
  const admin = createSupabaseAdminClient();
  const { data: existing, error } = await admin
    .from("nyx_conversations")
    .select("id")
    .eq("player_id", playerId)
    .eq("mode", "MISSION_CONTROL")
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  let conversationId = existing?.id as string | undefined;
  if (!conversationId) {
    const { data: created, error: createError } = await admin
      .from("nyx_conversations")
      .insert({ player_id: playerId, mode: "MISSION_CONTROL" } as never)
      .select("id")
      .single();
    if (createError || !created) throw createError ?? new Error("Gesprek kon niet starten.");
    conversationId = created.id as string;
    const { error: greetError } = await admin.from("nyx_messages").insert({
      conversation_id: conversationId,
      player_id: playerId,
      role: "NYX",
      content: NYX_GREETING,
      mode: "MISSION_CONTROL",
    } as never);
    if (greetError) throw greetError;
  }

  const companionId = await companionConversationId(playerId);
  const conversationIds = companionId && companionId !== conversationId ? [conversationId, companionId] : [conversationId];

  const { data: rows, error: msgError } = await admin
    .from("nyx_messages")
    .select("id, role, content, media_id, created_at")
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
