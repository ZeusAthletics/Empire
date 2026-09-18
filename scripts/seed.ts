import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { applyPhase1Schema, applyPhase3Schema, applyPhase4Schema, applyPhase5Schema, applyPhase6Schema } from "./apply-schema";
import { SEED_JOURNAL, SEED_WRAP_AUGUST } from "./seed-journal";
import { SEED_COMPANIES, SEED_CONTACTS, SEED_MAP_PINS, SEED_MISSIONS } from "./seed-missions";
import { STAT_KEYS, type Role, type StatKey } from "../src/server/domain/player/types";

function loadEnvFile(filename: string, override: boolean) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const PLAYER_STATS: { key: StatKey; value: number }[] = [
  { key: "capital", value: 78 },
  { key: "income", value: 65 },
  { key: "ownership", value: 52 },
  { key: "network", value: 86 },
  { key: "authority", value: 73 },
  { key: "strategy", value: 69 },
  { key: "execution", value: 61 },
  { key: "optionality", value: 47 },
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

type Admin = ReturnType<typeof createClient>;

async function ensureAuthUser(admin: Admin, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && data.user) return data.user;

  if (error && !/already been registered|already exists/i.test(error.message)) {
    throw error;
  }

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) {
    throw new Error(`Auth user ${email} already exists but could not be loaded.`);
  }
  return existing;
}

async function upsertPlayer(
  admin: Admin,
  input: {
    authUserId: string;
    role: Role;
    displayName: string;
    title: string;
    level: number;
    xp: number;
    xpToNext: number;
    lifetimeXp: number;
    stats: { key: StatKey; value: number }[];
  },
) {
  const { data: player, error } = await admin
    .from("players")
    .upsert(
      {
        auth_user_id: input.authUserId,
        role: input.role,
        display_name: input.displayName,
        title: input.title,
        level: input.level,
        xp: input.xp,
        xp_to_next: input.xpToNext,
        lifetime_xp: input.lifetimeXp,
        deleted_at: null,
      } as never,
      { onConflict: "auth_user_id" },
    )
    .select("id, display_name")
    .single();

  if (error || !player) throw error ?? new Error("Player upsert returned no row.");

  const { error: statsError } = await admin.from("stat_values").upsert(
    input.stats.map((stat) => ({
      player_id: player.id,
      key: stat.key,
      value: stat.value,
      deleted_at: null,
    })) as never,
    { onConflict: "player_id,key" },
  );

  if (statsError) throw statsError;
  return player;
}

async function tableReady(admin: Admin, table: string) {
  const { error } = await admin.from(table).select("id").limit(1);
  return !error;
}

async function ensureTable(admin: Admin, table: string, apply: () => Promise<void>, sqlFile: string) {
  if (await tableReady(admin, table)) return;
  console.log(`${table} table missing — applying SQL…`);
  try {
    await apply();
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n\nOpen the Supabase SQL Editor, paste ${sqlFile}, run it, then retry npm run db:seed.`,
    );
  }
  await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
  if (!(await tableReady(admin, table))) {
    throw new Error(
      `Table public.${table} is still missing. Open the Supabase SQL Editor, paste ${sqlFile}, run it, then retry npm run db:seed.`,
    );
  }
}

async function upsertChapterOne(
  admin: Admin,
  playerId: string,
  input: {
    title: string;
    northStar: string;
    bottleneckStat: StatKey;
    bottleneckReason: string;
    roman: string;
    name: string;
    tagline: string;
    economicFrom: number;
    economicTo: number;
    economicCurrent: number;
    exitCriteria: string[];
  },
) {
  const { data: existingCampaign, error: campaignLookupError } = await admin
    .from("campaigns")
    .select("id")
    .eq("player_id", playerId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();
  if (campaignLookupError) throw campaignLookupError;

  const campaignFields = {
    player_id: playerId,
    title: input.title,
    north_star: input.northStar,
    bottleneck_stat: input.bottleneckStat,
    bottleneck_reason: input.bottleneckReason,
    status: "ACTIVE",
    source: "ADMIN",
    locked_by_admin: false,
    deleted_at: null,
  };

  const { data: campaign, error: campaignError } = existingCampaign
    ? await admin.from("campaigns").update(campaignFields as never).eq("id", existingCampaign.id).select("id").single()
    : await admin.from("campaigns").insert(campaignFields as never).select("id").single();

  if (campaignError || !campaign) throw campaignError ?? new Error("Campaign upsert returned no row.");

  const { data: existingChapter, error: chapterLookupError } = await admin
    .from("chapters")
    .select("id, opened_at")
    .eq("campaign_id", campaign.id)
    .eq("index", 1)
    .is("deleted_at", null)
    .maybeSingle();
  if (chapterLookupError) throw chapterLookupError;

  const chapterFields = {
    campaign_id: campaign.id,
    player_id: playerId,
    index: 1,
    roman: input.roman,
    name: input.name,
    tagline: input.tagline,
    economic_from: input.economicFrom,
    economic_to: input.economicTo,
    economic_current: input.economicCurrent,
    exit_criteria: input.exitCriteria,
    status: "ACTIVE",
    opened_at: existingChapter?.opened_at ?? new Date().toISOString(),
    source: "ADMIN",
    locked_by_admin: false,
    deleted_at: null,
  };

  const { data: chapter, error: chapterError } = existingChapter
    ? await admin.from("chapters").update(chapterFields as never).eq("id", existingChapter.id).select("id").single()
    : await admin.from("chapters").insert(chapterFields as never).select("id").single();

  if (chapterError || !chapter) throw chapterError ?? new Error("Chapter upsert returned no row.");

  const { error: linkError } = await admin
    .from("campaigns")
    .update({ current_chapter_id: chapter.id } as never)
    .eq("id", campaign.id);
  if (linkError) throw linkError;

  return { campaignId: campaign.id as string, chapterId: chapter.id as string };
}

async function snapshotStats(
  admin: Admin,
  playerId: string,
  stats: { key: StatKey; value: number }[],
) {
  const at = new Date().toISOString();
  const { error } = await admin.from("stat_snapshots").insert(
    stats.map((stat) => ({
      player_id: playerId,
      key: stat.key,
      value: stat.value,
      at,
    })) as never,
  );
  if (error && error.code !== "23505" && !/duplicate|unique/i.test(error.message)) throw error;
}

async function seedContactsAndMissions(admin: Admin, playerId: string, chapterId: string) {
  const contactIds = new Map<string, string>();
  for (const contact of SEED_CONTACTS) {
    const { data: existing, error: lookupError } = await admin
      .from("contacts")
      .select("id")
      .eq("player_id", playerId)
      .eq("seed_key", contact.seedKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const fields = {
      player_id: playerId,
      seed_key: contact.seedKey,
      name: contact.name,
      role: contact.role,
      tier: contact.tier,
      lat: contact.lat,
      lng: contact.lng,
      note: contact.note,
      restricted: contact.restricted,
      source: "ADMIN",
      deleted_at: null,
    };
    const { data, error } = existing
      ? await admin.from("contacts").update(fields as never).eq("id", existing.id).select("id").single()
      : await admin.from("contacts").insert(fields as never).select("id").single();
    if (error || !data) throw error ?? new Error(`Contact ${contact.seedKey} failed.`);
    contactIds.set(contact.seedKey, data.id as string);
  }

  for (const mission of SEED_MISSIONS) {
    const { data: existing, error: lookupError } = await admin
      .from("missions")
      .select("id")
      .eq("player_id", playerId)
      .eq("seed_key", mission.seedKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const fields = {
      player_id: playerId,
      chapter_id: chapterId,
      seed_key: mission.seedKey,
      kind: mission.kind,
      track: mission.track,
      title: mission.title,
      why: mission.why,
      main_objective: mission.mainObjective,
      status: mission.status,
      difficulty: mission.difficulty,
      estimate_label: mission.estimateLabel,
      impact: mission.impact,
      xp_reward: mission.xpReward,
      xp_granted: mission.xpGranted,
      stat_reward_key: mission.statReward.key,
      stat_reward_amount: mission.statReward.amount,
      evidence_requirement: mission.evidenceRequirement,
      location_name: mission.locationName,
      location_address: mission.locationAddress ?? null,
      when_label: mission.whenLabel ?? null,
      lat: mission.lat,
      lng: mission.lng,
      featured: Boolean(mission.featured),
      source: "ADMIN",
      locked_by_admin: mission.status === "LOCKED",
      completed_at: mission.status === "COMPLETED" ? new Date().toISOString() : null,
      deleted_at: null,
    };
    const { data: row, error } = existing
      ? await admin.from("missions").update(fields as never).eq("id", existing.id).select("id").single()
      : await admin.from("missions").insert(fields as never).select("id").single();
    if (error || !row) throw error ?? new Error(`Mission ${mission.seedKey} failed.`);
    const missionId = row.id as string;

    await admin.from("mission_contacts").delete().eq("mission_id", missionId);
    const people = mission.people
      .map((key) => contactIds.get(key))
      .filter((id): id is string => Boolean(id));
    if (people.length) {
      const { error: linkError } = await admin.from("mission_contacts").insert(
        people.map((contactId) => ({ mission_id: missionId, contact_id: contactId })) as never,
      );
      if (linkError) throw linkError;
    }

    for (const [index, objective] of mission.objectives.entries()) {
      const { data: existingObj, error: objLookupError } = await admin
        .from("mission_objectives")
        .select("id")
        .eq("mission_id", missionId)
        .eq("seed_key", objective.seedKey)
        .is("deleted_at", null)
        .maybeSingle();
      if (objLookupError) throw objLookupError;
      const objFields = {
        mission_id: missionId,
        seed_key: objective.seedKey,
        label: objective.label,
        sort_order: index,
        optional: Boolean(objective.optional),
        status: objective.done ? "COMPLETED" : "OPEN",
        completed_at: objective.done ? new Date().toISOString() : null,
        deleted_at: null,
      };
      const { error: objError } = existingObj
        ? await admin.from("mission_objectives").update(objFields as never).eq("id", existingObj.id)
        : await admin.from("mission_objectives").insert(objFields as never);
      if (objError) throw objError;
    }
  }
}

async function seedCompaniesAndPins(admin: Admin, playerId: string) {
  for (const company of SEED_COMPANIES) {
    const { data: existing, error: lookupError } = await admin
      .from("companies")
      .select("id")
      .eq("player_id", playerId)
      .eq("seed_key", company.seedKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const fields = {
      player_id: playerId,
      seed_key: company.seedKey,
      name: company.name,
      sector: company.sector,
      lat: company.lat,
      lng: company.lng,
      source: "ADMIN",
      deleted_at: null,
    };
    const { error } = existing
      ? await admin.from("companies").update(fields as never).eq("id", existing.id)
      : await admin.from("companies").insert(fields as never);
    if (error) throw error;
  }

  for (const pin of SEED_MAP_PINS) {
    const { data: existing, error: lookupError } = await admin
      .from("map_pins")
      .select("id")
      .eq("player_id", playerId)
      .eq("seed_key", pin.seedKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const fields = {
      player_id: playerId,
      seed_key: pin.seedKey,
      title: pin.title,
      pin_type: pin.type,
      lat: pin.lat,
      lng: pin.lng,
      note: pin.note,
      custom: pin.custom,
      source: "ADMIN",
      locked_by_admin: pin.locked,
      deleted_at: null,
    };
    const { error } = existing
      ? await admin.from("map_pins").update(fields as never).eq("id", existing.id)
      : await admin.from("map_pins").insert(fields as never);
    if (error) throw error;
  }
}

async function seedJournalAndWraps(admin: Admin, playerId: string) {
  const [{ data: contacts, error: contactError }, { data: missions, error: missionError }] = await Promise.all([
    admin.from("contacts").select("id, seed_key").eq("player_id", playerId).is("deleted_at", null),
    admin.from("missions").select("id, seed_key").eq("player_id", playerId).is("deleted_at", null),
  ]);
  if (contactError) throw contactError;
  if (missionError) throw missionError;
  const contactIds = new Map((contacts ?? []).map((row) => [row.seed_key as string, row.id as string]));
  const missionIds = new Map((missions ?? []).map((row) => [row.seed_key as string, row.id as string]));

  for (const entry of SEED_JOURNAL) {
    const { data: existing, error: lookupError } = await admin
      .from("journal_entries")
      .select("id")
      .eq("player_id", playerId)
      .eq("seed_key", entry.seedKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const fields = {
      player_id: playerId,
      seed_key: entry.seedKey,
      occurred_at: entry.occurredAt(),
      title: entry.title,
      body: entry.body,
      icon: entry.icon,
      tags: entry.tags,
      contact_ids: entry.contactKeys.map((key) => contactIds.get(key)).filter((id): id is string => Boolean(id)),
      mission_id: entry.missionKey ? (missionIds.get(entry.missionKey) ?? null) : null,
      location_name: entry.locationName ?? null,
      media: entry.media,
      extra_media: entry.extraMedia,
      extraction_status: "DONE",
      source: "ADMIN",
      deleted_at: null,
    };
    const { error } = existing
      ? await admin.from("journal_entries").update(fields as never).eq("id", existing.id)
      : await admin.from("journal_entries").insert(fields as never);
    if (error) throw error;
  }

  const { data: existingWrap, error: wrapLookupError } = await admin
    .from("monthly_wraps")
    .select("id")
    .eq("player_id", playerId)
    .eq("month_id", SEED_WRAP_AUGUST.monthId)
    .is("deleted_at", null)
    .maybeSingle();
  if (wrapLookupError) throw wrapLookupError;
  const wrapFields = {
    player_id: playerId,
    month_id: SEED_WRAP_AUGUST.monthId,
    label: SEED_WRAP_AUGUST.label,
    year: SEED_WRAP_AUGUST.year,
    events: SEED_WRAP_AUGUST.events,
    new_contacts: SEED_WRAP_AUGUST.newContacts,
    missions_completed: SEED_WRAP_AUGUST.missionsCompleted,
    empire_delta: SEED_WRAP_AUGUST.empireDelta,
    deltas: SEED_WRAP_AUGUST.deltas,
    biggest_win: SEED_WRAP_AUGUST.biggestWin,
    biggest_mistake: SEED_WRAP_AUGUST.biggestMistake,
    best_relationship: SEED_WRAP_AUGUST.bestRelationship,
    key_decision: SEED_WRAP_AUGUST.keyDecision,
    best_mission: SEED_WRAP_AUGUST.bestMission,
    time_sink: SEED_WRAP_AUGUST.timeSink,
    what_changed: SEED_WRAP_AUGUST.whatChanged,
    nyx: SEED_WRAP_AUGUST.nyx,
    generated_at: null,
    entry_ids: [],
    source: "ADMIN",
    deleted_at: null,
  };
  const { error: wrapError } = existingWrap
    ? await admin.from("monthly_wraps").update(wrapFields as never).eq("id", existingWrap.id)
    : await admin.from("monthly_wraps").insert(wrapFields as never);
  if (wrapError) throw wrapError;
}

async function main() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const playerEmail = requiredEnv("SEED_PLAYER_EMAIL");
  const playerPassword = requiredEnv("SEED_PLAYER_PASSWORD");
  const adminEmail = requiredEnv("SEED_ADMIN_EMAIL");
  const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureTable(
    admin,
    "players",
    applyPhase1Schema,
    "supabase/migrations/20260918120000_phase1_player.sql",
  );
  await ensureTable(
    admin,
    "campaigns",
    applyPhase3Schema,
    "supabase/migrations/20260918210000_phase3_campaign.sql",
  );
  await ensureTable(
    admin,
    "missions",
    applyPhase4Schema,
    "supabase/migrations/20260918220000_phase4_missions.sql",
  );
  await ensureTable(
    admin,
    "map_pins",
    applyPhase5Schema,
    "supabase/migrations/20260918230000_phase5_map.sql",
  );
  await ensureTable(
    admin,
    "journal_entries",
    applyPhase6Schema,
    "supabase/migrations/20260919010000_phase6_journal.sql",
  );

  const playerAuth = await ensureAuthUser(admin, playerEmail, playerPassword);
  const adminAuth = await ensureAuthUser(admin, adminEmail, adminPassword);

  const player = await upsertPlayer(admin, {
    authUserId: playerAuth.id,
    role: "PLAYER",
    displayName: "HARDWIG AERTS",
    title: "STRATEGIC OPERATOR",
    level: 12,
    xp: 7420,
    xpToNext: 10000,
    lifetimeXp: 24860,
    stats: PLAYER_STATS,
  });

  const operator = await upsertPlayer(admin, {
    authUserId: adminAuth.id,
    role: "ADMIN",
    displayName: "EMPIRE OPS",
    title: "OPERATOR",
    level: 1,
    xp: 0,
    xpToNext: 1000,
    lifetimeXp: 0,
    stats: STAT_KEYS.map((key) => ({ key, value: 0 })),
  });

  const chapter = await upsertChapterOne(admin, player.id, {
    title: "€0 → €100.000.000",
    northStar: "Financiële vrijheid begint met een beslissing",
    bottleneckStat: "optionality",
    bottleneckReason: "Optionality is de rem: te weinig paden naast het huidige aanbod.",
    roman: "I",
    name: "ESCAPE VELOCITY",
    tagline: "Groter denken. Verder gaan.",
    economicFrom: 0,
    economicTo: 100000,
    economicCurrent: 64800,
    exitCriteria: ["De eerste €10.000-maand is een feit."],
  });
  await snapshotStats(admin, player.id, PLAYER_STATS);
  const { chapterId } = chapter;
  await seedContactsAndMissions(admin, player.id, chapterId);
  await seedCompaniesAndPins(admin, player.id);
  await seedJournalAndWraps(admin, player.id);

  console.log(`Seeded player ${player.display_name} (${playerEmail})`);
  console.log(`Seeded admin ${operator.display_name} (${adminEmail})`);
  console.log(`Seeded chapter I ${chapter.chapterId}`);
  console.log(`Seeded ${SEED_CONTACTS.length} contacts and ${SEED_MISSIONS.length} missions`);
  console.log(`Seeded ${SEED_COMPANIES.length} companies and ${SEED_MAP_PINS.length} map pins`);
  console.log(`Seeded ${SEED_JOURNAL.length} journal entries and wrap ${SEED_WRAP_AUGUST.label}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
