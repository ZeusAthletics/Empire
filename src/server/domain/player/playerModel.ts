import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STAT_WEIGHTS, STAT_KEYS, type StatKey } from "@/server/domain/player/types";

export type PlayerModel = {
  playerId: string;
  weights: Record<StatKey, number>;
  principles: string[];
  constraints: string[];
  energyGivers: string[];
  energyDrains: string[];
  version: number;
  updatedAt: string;
};

export type PlayerModelDraft = {
  weights?: Partial<Record<StatKey, number>>;
  principles: string[];
  constraints: string[];
  energyGivers: string[];
  energyDrains: string[];
};

function asWeights(value: unknown): Record<StatKey, number> {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...DEFAULT_STAT_WEIGHTS };
  for (const key of STAT_KEYS) {
    const n = Number(raw[key]);
    if (Number.isFinite(n)) next[key] = Math.min(2, Math.max(0, n));
  }
  return next;
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

function mapModel(row: Record<string, unknown>): PlayerModel {
  return {
    playerId: row.player_id as string,
    weights: asWeights(row.weights),
    principles: asList(row.principles),
    constraints: asList(row.constraints),
    energyGivers: asList(row.energy_givers),
    energyDrains: asList(row.energy_drains),
    version: Number(row.version ?? 1),
    updatedAt: (row.updated_at as string) ?? "",
  };
}

export function summarizePlayerModel(model: PlayerModel | null): string | null {
  if (!model) return null;
  const parts = [
    model.principles.length ? `principes: ${model.principles.join("; ")}` : null,
    model.constraints.length ? `beperkingen: ${model.constraints.join("; ")}` : null,
    model.energyGivers.length ? `energie: ${model.energyGivers.join("; ")}` : null,
    model.energyDrains.length ? `drain: ${model.energyDrains.join("; ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export async function getPlayerModel(playerId: string): Promise<PlayerModel | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_models")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) {
    if (/player_models|schema cache|does not exist/i.test(error.message)) return null;
    throw error;
  }
  return data ? mapModel(data as Record<string, unknown>) : null;
}

export async function upsertPlayerModel(playerId: string, draft: PlayerModelDraft): Promise<PlayerModel> {
  const admin = createSupabaseAdminClient();
  const current = await getPlayerModel(playerId);
  const payload = {
    player_id: playerId,
    weights: { ...DEFAULT_STAT_WEIGHTS, ...current?.weights, ...draft.weights },
    principles: draft.principles,
    constraints: draft.constraints,
    energy_givers: draft.energyGivers,
    energy_drains: draft.energyDrains,
    version: (current?.version ?? 0) + 1,
  };
  const { data, error } = await admin
    .from("player_models")
    .upsert(payload as never, { onConflict: "player_id" })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Spelersmodel kon niet worden bewaard.");
  return mapModel(data as Record<string, unknown>);
}
