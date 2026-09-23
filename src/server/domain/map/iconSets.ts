import { mapIconAssetUrl } from "@/lib/map-icon-assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MapIconSet = {
  slug: string;
  title: string;
  active: boolean;
  gridCols: number;
  gridRows: number;
  iconCount: number;
  assetPath: string;
  cellWidth: number;
  cellHeight: number;
  sortOrder: number;
};

export type MapIconCatalog = {
  sets: MapIconSet[];
};

const ICON_KEY = /^([a-z0-9-]+):(\d+)$/;

function mapSetRow(row: Record<string, unknown>): MapIconSet {
  return {
    slug: row.slug as string,
    title: row.title as string,
    active: Boolean(row.active),
    gridCols: Number(row.grid_cols) || 1,
    gridRows: Number(row.grid_rows) || 1,
    iconCount: Number(row.icon_count) || 0,
    assetPath: row.asset_path as string,
    cellWidth: Number(row.cell_width) || 32,
    cellHeight: Number(row.cell_height) || 32,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function isMissingTable(error: { code?: string; message?: string }, table: string): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes(table) && (msg.includes("does not exist") || msg.includes("could not find"));
}

export function parseIconKey(raw: string): { setSlug: string; index: number } | null {
  const match = raw.trim().match(ICON_KEY);
  if (!match) return null;
  return { setSlug: match[1], index: Number.parseInt(match[2], 10) };
}

export function resolveIconSrc(iconKey: string | null | undefined, setsBySlug: Map<string, MapIconSet>): string | null {
  if (!iconKey) return null;
  const parsed = parseIconKey(iconKey);
  if (!parsed) return null;
  const set = setsBySlug.get(parsed.setSlug);
  if (!set?.active) return null;
  if (parsed.index < 0 || parsed.index >= set.iconCount) return null;
  return mapIconAssetUrl(set.slug, parsed.index);
}

export async function listMapIconSets(activeOnly = false): Promise<MapIconSet[]> {
  const admin = createSupabaseAdminClient();
  let query = admin.from("map_icon_sets").select("*").order("sort_order", { ascending: true });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error, "map_icon_sets")) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapSetRow(row as Record<string, unknown>));
}

export async function setMapIconSetActive(slug: string, active: boolean): Promise<MapIconSet> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("map_icon_sets")
    .update({ active } as never)
    .eq("slug", slug)
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error, "map_icon_sets")) {
      throw new Error("Database-migratie ontbreekt: voer 20260923100000_map_icon_sets.sql uit.");
    }
    throw error;
  }
  return mapSetRow(data as Record<string, unknown>);
}

export async function loadPlayerMarkerIcons(playerId: string): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("player_map_marker_icons")
    .select("marker_key, icon_key")
    .eq("player_id", playerId);
  if (error) {
    if (isMissingTable(error, "player_map_marker_icons")) return new Map();
    throw error;
  }
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.marker_key as string, row.icon_key as string);
  }
  return map;
}

export async function validateIconKey(iconKey: string): Promise<boolean> {
  const parsed = parseIconKey(iconKey);
  if (!parsed) return false;
  const sets = await listMapIconSets(true);
  const set = sets.find((item) => item.slug === parsed.setSlug);
  if (!set) return false;
  return parsed.index >= 0 && parsed.index < set.iconCount;
}

export async function setPlayerMarkerIcon(playerId: string, markerKey: string, iconKey: string | null) {
  const key = markerKey.trim();
  if (!key) throw new Error("Marker ontbreekt.");
  const admin = createSupabaseAdminClient();
  if (!iconKey) {
    const { error } = await admin
      .from("player_map_marker_icons")
      .delete()
      .eq("player_id", playerId)
      .eq("marker_key", key);
    if (error && !isMissingTable(error, "player_map_marker_icons")) throw error;
    return;
  }
  if (!(await validateIconKey(iconKey))) {
    throw new Error("Ongeldig icoon of set niet actief.");
  }
  const { error } = await admin.from("player_map_marker_icons").upsert(
    {
      player_id: playerId,
      marker_key: key,
      icon_key: iconKey,
    } as never,
    { onConflict: "player_id,marker_key" },
  );
  if (error) {
    if (isMissingTable(error, "player_map_marker_icons")) {
      throw new Error("Database-migratie ontbreekt: voer 20260923100000_map_icon_sets.sql uit.");
    }
    throw error;
  }
}

export function buildIconCatalog(sets: MapIconSet[]): MapIconCatalog {
  return { sets: sets.filter((set) => set.active) };
}
