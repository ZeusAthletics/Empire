import { openaiConfigured } from "@/server/ai/client/openai";
import { offlineCheckInMessage } from "@/server/ai/fallback/nyxCheckIn";
import { stripModelNames } from "@/server/ai/fallback/nyxReply";
import { runNyxTask } from "@/server/ai/orchestrator/NyxOrchestrator";
import { evaluateCheckInEligibility } from "@/server/domain/nyx/checkIn/eligibility";
import { rollCheckInLottery } from "@/server/domain/nyx/checkIn/lottery";
import {
  countCheckInsLast7Days,
  lastCheckInAt,
  lastUserMessageAt,
  missionControlSilenceAnchor,
} from "@/server/domain/nyx/checkIn/repository";
import { resolvePlayerIntimacyTier } from "@/server/domain/nyx/outreach/intimacy";
import {
  appendOutboundNyxMessage,
  featuredTalkContext,
  getOrCreateTalk,
} from "@/server/domain/nyx/talkRepository";
import { findPlayerById } from "@/server/domain/player/repository";
import { formatPlayerLocalTime, formatPlayerLocalTimeLine } from "@/server/domain/player/localTime";
import { formatActiveMissionsForPrompt } from "@/server/domain/mission/nyxContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CheckInResult =
  | { sent: false; reason: string }
  | { sent: true; messageId: string; content: string };

export async function maybeSendNyxCheckIn(playerId: string, now = new Date()): Promise<CheckInResult> {
  const [player, lastUser, lastCheckIn, checkIns7d, anchor, intimacyTier] = await Promise.all([
    findPlayerById(playerId),
    lastUserMessageAt(playerId),
    lastCheckInAt(playerId),
    countCheckInsLast7Days(playerId, now),
    missionControlSilenceAnchor(playerId),
    resolvePlayerIntimacyTier(playerId),
  ]);

  const nowMs = now.getTime();
  const eligibility = evaluateCheckInEligibility({
    nowMs,
    lastUserAtMs: lastUser ? new Date(lastUser).getTime() : null,
    silenceAnchorMs: anchor ? new Date(anchor).getTime() : null,
    lastCheckInAtMs: lastCheckIn ? new Date(lastCheckIn).getTime() : null,
    checkInsLast7Days: checkIns7d,
  });

  if (!eligibility.ok) {
    return { sent: false, reason: eligibility.reason };
  }

  const tz = player?.timeZone ?? "Europe/Brussels";
  const local = formatPlayerLocalTime(tz, now);

  const wonLottery = rollCheckInLottery({
    tier: intimacyTier,
    hoursSilent: eligibility.hoursSilent,
    isDaytime: local.isDaytime,
    random: Math.random(),
  });

  if (!wonLottery) {
    return { sent: false, reason: "Lottery: deze tick geen check-in." };
  }

  const ctx = await featuredTalkContext(playerId);
  const missionBlock = formatActiveMissionsForPrompt(ctx.activeMissions);
  const localLine = formatPlayerLocalTimeLine(local);

  let content: string;
  let runId: string | null = null;

  if (openaiConfigured()) {
    const live = await runNyxTask({
      playerId,
      task: "NYX_CHECKIN",
      text: `${localLine}\nStilte sinds Hardwig: ~${Math.round(eligibility.hoursSilent)} uur.\nIntimacy tier: ${intimacyTier}\n${missionBlock}`,
      invokeModel: true,
    }).catch(() => null);
    if (live?.text?.trim()) {
      content = stripModelNames(live.text.trim());
      runId = live.runId;
    } else {
      content = offlineCheckInMessage(intimacyTier, local, eligibility.hoursSilent);
    }
  } else {
    content = offlineCheckInMessage(intimacyTier, local, eligibility.hoursSilent);
  }

  const talk = await getOrCreateTalk(playerId);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_messages")
    .insert({
      conversation_id: talk.conversationId,
      player_id: playerId,
      role: "NYX",
      content,
      mode: "MISSION_CONTROL",
      run_id: runId,
      is_check_in: true,
    } as never)
    .select("id")
    .single();

  if (error) {
    if (/is_check_in|schema cache|column/i.test(error.message)) {
      const fallback = await appendOutboundNyxMessage({
        playerId,
        conversationId: talk.conversationId,
        content,
        runId,
      });
      return { sent: true, messageId: fallback.id, content };
    }
    throw error;
  }

  return { sent: true, messageId: data.id as string, content };
}
