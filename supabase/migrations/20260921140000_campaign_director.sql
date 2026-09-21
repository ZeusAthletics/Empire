-- Campaign Director: chapter skeleton, exit criteria, mission graph, progression events.

alter type public.mission_status add value if not exists 'PLANNED';
alter type public.mission_status add value if not exists 'ARCHIVED';

do $$ begin
  create type public.exit_criterion_kind as enum ('STAT', 'EMPIRE_VALUE', 'MISSION_COUNT', 'MANUAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.exit_comparator as enum ('GTE', 'LTE', 'EQ');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.exit_criterion_status as enum ('OPEN', 'MET', 'WAIVED');
exception when duplicate_object then null;
end $$;

alter table public.campaigns
  add column if not exists progression_lock_at timestamptz,
  add column if not exists plan_version integer not null default 1;

alter table public.chapters
  add column if not exists subtitle text,
  add column if not exists strategic_purpose text,
  add column if not exists start_conditions text[] not null default '{}',
  add column if not exists desired_state text[] not null default '{}',
  add column if not exists dependencies text[] not null default '{}',
  add column if not exists related_stats public.stat_key[] not null default '{}',
  add column if not exists strategic_risks text[] not null default '{}',
  add column if not exists assumptions text[] not null default '{}',
  add column if not exists skeleton jsonb,
  add column if not exists locked_fields text[] not null default '{}';

create table if not exists public.chapter_exit_criteria (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  label text not null,
  kind public.exit_criterion_kind not null default 'MANUAL',
  stat_key public.stat_key,
  comparator public.exit_comparator,
  target_value numeric,
  status public.exit_criterion_status not null default 'OPEN',
  met_at timestamptz,
  locked_by_admin boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chapter_exit_criteria_chapter_idx
  on public.chapter_exit_criteria (chapter_id, sort_order);

alter table public.missions
  add column if not exists narrative_order integer,
  add column if not exists strategic_reason text,
  add column if not exists success_criteria text[] not null default '{}',
  add column if not exists expected_state_changes text[] not null default '{}',
  add column if not exists unlock_conditions text[] not null default '{}',
  add column if not exists advances_criteria uuid[] not null default '{}',
  add column if not exists planned_payload jsonb,
  add column if not exists revalidated_at timestamptz;

create table if not exists public.mission_dependencies (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  prerequisite_mission_id uuid not null references public.missions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mission_id, prerequisite_mission_id)
);

create index if not exists mission_dependencies_mission_idx on public.mission_dependencies (mission_id);

create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}',
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists campaign_events_player_idx on public.campaign_events (player_id, created_at desc);

create table if not exists public.campaign_plan_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, version)
);

-- Backfill legacy exit_criteria strings into evaluable rows (MANUAL until replanned).
insert into public.chapter_exit_criteria (chapter_id, player_id, label, kind, status, sort_order)
select
  c.id,
  c.player_id,
  ec.label,
  'MANUAL'::public.exit_criterion_kind,
  'OPEN'::public.exit_criterion_status,
  ec.ord
from public.chapters c
cross join lateral unnest(c.exit_criteria) with ordinality as ec(label, ord)
where cardinality(c.exit_criteria) > 0
  and not exists (
    select 1 from public.chapter_exit_criteria x where x.chapter_id = c.id
  );

alter table public.chapter_exit_criteria enable row level security;
alter table public.mission_dependencies enable row level security;
alter table public.campaign_events enable row level security;
alter table public.campaign_plan_versions enable row level security;

revoke all on table public.chapter_exit_criteria from anon, authenticated;
revoke all on table public.mission_dependencies from anon, authenticated;
revoke all on table public.campaign_events from anon, authenticated;
revoke all on table public.campaign_plan_versions from anon, authenticated;

drop trigger if exists chapter_exit_criteria_updated_at on public.chapter_exit_criteria;
create trigger chapter_exit_criteria_updated_at
  before update on public.chapter_exit_criteria
  for each row execute procedure public.set_updated_at();

notify pgrst, 'reload schema';
