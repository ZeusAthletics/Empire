-- Phase 4: missions, evidence, proposals, contacts. RLS on; service role only.

do $$ begin
  create type public.mission_kind as enum ('MAIN','BOSS','EVENT','BUSINESS','CONTENT','NETWORK','OPPORTUNITY');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_track as enum ('MAIN_STORY','SIDE_QUEST');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_status as enum (
    'PROPOSED','ACTIVE','BLOCKED','COMPLETED','COMPLETED_UNVERIFIED','ABANDONED','LOCKED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.mission_difficulty as enum ('LOW','MEDIUM','HIGH','BOSS');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.objective_status as enum ('OPEN','COMPLETED','SKIPPED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.evidence_kind as enum ('JOURNAL_ENTRY','PHOTO','CONTACT_LINK','DOCUMENT','USER_ATTESTED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.proposal_kind as enum (
    'MEMORY','MEMORY_REVISION','PATTERN','SIDE_QUEST','MAIN_QUEST_CHANGE',
    'CAMPAIGN_REVIEW','PLAYER_MODEL_CHANGE','OPPORTUNITY'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.proposal_status as enum ('PENDING','AUTO_APPROVED','APPROVED','REJECTED','EXPIRED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.confidence as enum ('TENTATIVE','LIKELY','CONFIRMED','EXPLICIT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.importance as enum ('LOW','MEDIUM','HIGH','CRITICAL');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nyx_run_status as enum ('OK','ERROR','REFUSED','TIMEOUT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.decided_by as enum ('USER','SYSTEM','ADMIN');
exception when duplicate_object then null;
end $$;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  name text not null,
  role text,
  tier text,
  lat double precision,
  lng double precision,
  note text,
  restricted boolean not null default false,
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists contacts_player_seed_uidx
  on public.contacts (player_id, seed_key)
  where seed_key is not null and deleted_at is null;

create index if not exists contacts_player_id_idx on public.contacts (player_id);

create table if not exists public.nyx_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  request_id text,
  task_type text,
  service text,
  model text,
  model_tier text,
  prompt_version text,
  routing_reason text,
  reasoning_effort text,
  context_refs jsonb not null default '[]',
  risk_profile jsonb,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  cost_cents integer,
  estimated_cost_cents integer,
  fallback_used boolean not null default false,
  structured_output_valid boolean,
  status public.nyx_run_status not null default 'OK',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists nyx_runs_player_id_idx on public.nyx_runs (player_id);

create table if not exists public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.nyx_runs (id) on delete cascade,
  tool text not null,
  args jsonb,
  result jsonb,
  accepted boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists tool_calls_run_id_idx on public.tool_calls (run_id);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  kind public.proposal_kind not null,
  payload jsonb not null default '{}',
  rationale text not null,
  confidence public.confidence not null default 'TENTATIVE',
  importance public.importance not null default 'MEDIUM',
  run_id uuid references public.nyx_runs (id),
  status public.proposal_status not null default 'PENDING',
  decided_by public.decided_by,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists proposals_player_id_idx on public.proposals (player_id);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  chapter_id uuid references public.chapters (id),
  seed_key text,
  kind public.mission_kind not null,
  track public.mission_track not null,
  title text not null,
  why text not null,
  main_objective text not null,
  status public.mission_status not null default 'PROPOSED',
  difficulty public.mission_difficulty not null default 'MEDIUM',
  estimate_label text,
  estimate_minutes integer not null default 0,
  impact text,
  xp_reward integer not null,
  xp_granted integer not null default 0,
  stat_reward_key public.stat_key not null,
  stat_reward_amount integer not null default 0,
  evidence_requirement text not null,
  evidence_kinds public.evidence_kind[] not null default '{USER_ATTESTED}',
  location_name text,
  location_address text,
  when_label text,
  lat double precision,
  lng double precision,
  featured boolean not null default false,
  origin_proposal_id uuid references public.proposals (id),
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists missions_player_seed_uidx
  on public.missions (player_id, seed_key)
  where seed_key is not null and deleted_at is null;

create index if not exists missions_player_id_idx on public.missions (player_id);
create index if not exists missions_player_status_idx on public.missions (player_id, status);

create table if not exists public.mission_objectives (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  seed_key text,
  label text not null,
  sort_order integer not null,
  optional boolean not null default false,
  status public.objective_status not null default 'OPEN',
  evidence_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists mission_objectives_seed_uidx
  on public.mission_objectives (mission_id, seed_key)
  where seed_key is not null and deleted_at is null;

create index if not exists mission_objectives_mission_id_idx on public.mission_objectives (mission_id);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  kind public.evidence_kind not null,
  mission_id uuid references public.missions (id),
  objective_id uuid references public.mission_objectives (id),
  journal_entry_id uuid,
  contact_id uuid references public.contacts (id),
  file_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists evidence_player_id_idx on public.evidence (player_id);
create index if not exists evidence_mission_id_idx on public.evidence (mission_id);

do $$ begin
  alter table public.mission_objectives
    add constraint mission_objectives_evidence_id_fkey
    foreign key (evidence_id) references public.evidence (id);
exception when duplicate_object then null;
end $$;

create table if not exists public.mission_contacts (
  mission_id uuid not null references public.missions (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  primary key (mission_id, contact_id)
);

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();

drop trigger if exists missions_updated_at on public.missions;
create trigger missions_updated_at
  before update on public.missions
  for each row execute procedure public.set_updated_at();

drop trigger if exists mission_objectives_updated_at on public.mission_objectives;
create trigger mission_objectives_updated_at
  before update on public.mission_objectives
  for each row execute procedure public.set_updated_at();

alter table public.contacts enable row level security;
alter table public.nyx_runs enable row level security;
alter table public.tool_calls enable row level security;
alter table public.proposals enable row level security;
alter table public.missions enable row level security;
alter table public.mission_objectives enable row level security;
alter table public.evidence enable row level security;
alter table public.mission_contacts enable row level security;

revoke all on table public.contacts from anon, authenticated;
revoke all on table public.nyx_runs from anon, authenticated;
revoke all on table public.tool_calls from anon, authenticated;
revoke all on table public.proposals from anon, authenticated;
revoke all on table public.missions from anon, authenticated;
revoke all on table public.mission_objectives from anon, authenticated;
revoke all on table public.evidence from anon, authenticated;
revoke all on table public.mission_contacts from anon, authenticated;

notify pgrst, 'reload schema';
