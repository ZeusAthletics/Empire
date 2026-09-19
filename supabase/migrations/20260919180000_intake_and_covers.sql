-- Intake profile, player model, mission covers, and Hardwig demo wipe.
-- Paste in the Supabase SQL Editor. Scoped wipe never touches ADMIN or restricted c-jdi.

alter table public.players
  add column if not exists intake_completed_at timestamptz;

create table if not exists public.player_models (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players (id) on delete cascade,
  weights jsonb not null default '{}'::jsonb,
  principles text[] not null default '{}',
  constraints text[] not null default '{}',
  energy_givers text[] not null default '{}',
  energy_drains text[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_models_player_id_idx on public.player_models (player_id);

alter table public.player_models enable row level security;
revoke all on table public.player_models from anon, authenticated;

alter table public.missions
  add column if not exists media_id uuid references public.media_assets (id);

drop trigger if exists player_models_updated_at on public.player_models;
create trigger player_models_updated_at
  before update on public.player_models
  for each row execute procedure public.set_updated_at();

-- One-shot reset of seeded Hardwig fiction.
do $$
declare
  pid uuid;
begin
  select id into pid
  from public.players
  where display_name = 'HARDWIG AERTS'
    and role = 'PLAYER'
    and deleted_at is null
  limit 1;

  if pid is null then
    return;
  end if;

  delete from public.opportunity_signals where player_id = pid;
  delete from public.tool_calls
    where run_id in (select id from public.nyx_runs where player_id = pid);
  delete from public.nyx_messages where player_id = pid;
  delete from public.nyx_conversations where player_id = pid;
  delete from public.nyx_runs where player_id = pid;
  delete from public.notification_interrupts where player_id = pid;
  update public.mission_objectives
  set evidence_id = null
  where mission_id in (select id from public.missions where player_id = pid);
  update public.evidence
  set objective_id = null, mission_id = null, contact_id = null
  where player_id = pid;
  delete from public.evidence where player_id = pid;
  delete from public.mission_objectives
    where mission_id in (select id from public.missions where player_id = pid);
  delete from public.mission_contacts
    where mission_id in (select id from public.missions where player_id = pid);
  delete from public.journal_entries where player_id = pid;
  delete from public.monthly_wraps where player_id = pid;
  update public.missions set media_id = null where player_id = pid;
  delete from public.missions where player_id = pid;
  delete from public.proposals where player_id = pid;
  delete from public.memory_versions
    where memory_id in (select id from public.memories where player_id = pid);
  delete from public.memories where player_id = pid;
  delete from public.strategic_patterns where player_id = pid;
  delete from public.opportunities where player_id = pid;
  delete from public.companies where player_id = pid;
  delete from public.map_pins where player_id = pid;
  delete from public.empire_value_entries where player_id = pid;
  delete from public.stat_snapshots where player_id = pid;
  delete from public.media_assets where player_id = pid;
  delete from public.player_models where player_id = pid;

  update public.campaigns set current_chapter_id = null where player_id = pid;
  delete from public.chapters where player_id = pid;
  delete from public.campaigns where player_id = pid;

  delete from public.contacts
  where player_id = pid
    and restricted is not true;

  update public.stat_values
  set value = 0
  where player_id = pid;

  update public.players
  set
    title = 'OPERATOR',
    level = 1,
    xp = 0,
    xp_to_next = 1000,
    lifetime_xp = 0,
    home_address = null,
    home_lat = null,
    home_lng = null,
    intake_completed_at = null
  where id = pid;
end $$;

notify pgrst, 'reload schema';
