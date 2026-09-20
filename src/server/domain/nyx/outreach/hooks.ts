import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatChatLineForPrompt } from "@/server/domain/nyx/chatFormat";
import { listMissions } from "@/server/domain/mission/repository";
import { retrieveRelevantMemories } from "@/server/domain/memory/repository";

export type OutreachHookContext = {
  hooks: string[];
  recentChat: string[];
};

export async function collectOutreachHooks(playerId: string): Promise<OutreachHookContext> {
  const admin = createSupabaseAdminClient();
  const hooks: string[] = [];

  const { data: messages, error } = await admin
    .from("nyx_messages")
    .select("role, content, media_id, media_context, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  const recentChat = [...(messages ?? [])]
    .reverse()
    .map((row) =>
      formatChatLineForPrompt(row as { role: string; content: string; media_id?: string | null; media_context?: string | null }),
    );

  const recentUser = (messages ?? []).filter((row) => row.role === "USER");
  if (recentUser.length) {
    const latest = recentUser[0];
    const ageH = (Date.now() - new Date(latest.created_at as string).getTime()) / (1000 * 60 * 60);
    if (ageH < 48) hooks.push(`Recent chat (${Math.round(ageH)}h): ${latest.content}`);
  }

  const memories = await retrieveRelevantMemories(playerId).catch(() => []);
  for (const memory of memories.slice(0, 6)) {
    if (memory.importance === "HIGH" || memory.domain === "RELATIONSHIP") {
      hooks.push(`Memory (${memory.domain}): ${memory.normalizedFact}`);
    }
  }

  const missions = await listMissions(playerId).catch(() => []);
  const won = missions
    .filter((m) => m.status === "COMPLETED" || m.status === "COMPLETED_UNVERIFIED")
    .slice(0, 2);
  for (const mission of won) {
    hooks.push(`Missie afgerond: ${mission.title}`);
  }

  const keywords = /training|auto|deal|gym|wagen|contract/i;
  for (const line of recentChat) {
    if (keywords.test(line)) {
      hooks.push(`Thema in gesprek: ${line.slice(0, 120)}`);
      break;
    }
  }

  return { hooks, recentChat };
}

export function hasOutreachHook(context: OutreachHookContext): boolean {
  return context.hooks.length > 0;
}
