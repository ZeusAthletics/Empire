import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RelationshipDirectionMode = "natural" | "guided";

export type RelationshipDirection = {
  mode: RelationshipDirectionMode;
  scenarioId: string | null;
  scenarioTitle: string | null;
  scenarioSummary: string | null;
  sourceSnapshotId: string | null;
  updatedAt: string | null;
};

const DEFAULT_DIRECTION: RelationshipDirection = {
  mode: "natural",
  scenarioId: null,
  scenarioTitle: null,
  scenarioSummary: null,
  sourceSnapshotId: null,
  updatedAt: null,
};

function isMissingDirectionTable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("nyx_relationship_direction") &&
    (msg.includes("does not exist") || msg.includes("could not find"))
  );
}

function mapDirection(row: Record<string, unknown>): RelationshipDirection {
  const mode = row.mode === "guided" ? "guided" : "natural";
  return {
    mode,
    scenarioId: (row.scenario_id as string | null) ?? null,
    scenarioTitle: (row.scenario_title as string | null) ?? null,
    scenarioSummary: (row.scenario_summary as string | null) ?? null,
    sourceSnapshotId: (row.source_snapshot_id as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

export async function getRelationshipDirection(playerId: string): Promise<RelationshipDirection> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_relationship_direction")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) {
    if (isMissingDirectionTable(error)) return DEFAULT_DIRECTION;
    throw error;
  }
  return data ? mapDirection(data as Record<string, unknown>) : DEFAULT_DIRECTION;
}

export async function setRelationshipDirection(
  playerId: string,
  input: {
    mode: RelationshipDirectionMode;
    scenarioId?: string | null;
    scenarioTitle?: string | null;
    scenarioSummary?: string | null;
    sourceSnapshotId?: string | null;
  },
): Promise<RelationshipDirection> {
  const mode = input.mode === "guided" ? "guided" : "natural";
  const payload =
    mode === "natural"
      ? {
          player_id: playerId,
          mode: "natural" as const,
          scenario_id: null,
          scenario_title: null,
          scenario_summary: null,
          source_snapshot_id: null,
        }
      : {
          player_id: playerId,
          mode: "guided" as const,
          scenario_id: input.scenarioId?.trim() || null,
          scenario_title: input.scenarioTitle?.trim() || null,
          scenario_summary: input.scenarioSummary?.trim() || null,
          source_snapshot_id: input.sourceSnapshotId ?? null,
        };

  if (mode === "guided" && (!payload.scenario_title || !payload.scenario_summary)) {
    throw new Error("Kies een scenario met titel en samenvatting.");
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("nyx_relationship_direction")
    .upsert(payload as never, { onConflict: "player_id" })
    .select("*")
    .single();
  if (error) {
    if (isMissingDirectionTable(error)) {
      throw new Error(
        "Database-migratie ontbreekt: voer 20260922150000_nyx_relationship_scenarios.sql uit in Supabase.",
      );
    }
    throw error;
  }
  return mapDirection(data as Record<string, unknown>);
}

/** Internal ops hint for Nyx model context (not shown to Hardwig). */
export function formatRelationshipDirectionForContext(direction: RelationshipDirection): string | null {
  if (direction.mode === "natural") {
    return "Relatierichting (intern): laat de band organisch evolueren via chat — geen door Empire Ops gekozen toekomstscenario.";
  }
  if (!direction.scenarioTitle || !direction.scenarioSummary) return null;
  return `Relatierichting (intern, door Empire Ops gekozen): Nyx mag subtiel naar dit scenario toe bewegen — niet forceren, wel consistent blijven met: «${direction.scenarioTitle}». ${direction.scenarioSummary}`;
}
