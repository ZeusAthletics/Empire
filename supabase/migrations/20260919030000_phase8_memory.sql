-- Phase 8: Nyx memories. Append-only versions. RLS on; service role only.

do $$ begin
  create type public.memory_domain as enum (
    'PERSONAL', 'CAMPAIGN', 'STRATEGIC', 'RELATIONSHIP', 'PREFERENCE', 'CONVERSATION_SUMMARY'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.memory_status as enum ('ACTIVE', 'SUPERSEDED', 'REJECTED', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.memory_source_type as enum ('CHAT', 'JOURNAL', 'MISSION', 'MANUAL', 'IMPORT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.memory_changed_by as enum ('AI', 'USER', 'SYSTEM');
exception when duplicate_object then null;
end $$;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  domain public.memory_domain not null,
  category text not null,
  content text not null,
  normalized_fact text not null,
  confidence public.confidence not null default 'TENTATIVE',
  importance public.importance not null default 'MEDIUM',
  status public.memory_status not null default 'ACTIVE',
  source_type public.memory_source_type not null default 'CHAT',
  source_id text,
  observation_count integer not null default 1,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  last_referenced_at timestamptz,
  user_confirmed boolean not null default false,
  supersedes_memory_id uuid references public.memories (id) on delete set null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists memories_player_seed_uidx
  on public.memories (player_id, seed_key)
  where seed_key is not null;

create unique index if not exists memories_player_active_fact_uidx
  on public.memories (player_id, normalized_fact)
  where status = 'ACTIVE';

create index if not exists memories_player_id_idx on public.memories (player_id);
create index if not exists memories_player_status_idx on public.memories (player_id, status);

create table if not exists public.memory_versions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  snapshot jsonb not null,
  changed_by public.memory_changed_by not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists memory_versions_memory_id_idx on public.memory_versions (memory_id);

drop trigger if exists memories_updated_at on public.memories;
create trigger memories_updated_at
  before update on public.memories
  for each row execute procedure public.set_updated_at();

alter table public.memories enable row level security;
alter table public.memory_versions enable row level security;

revoke all on table public.memories from anon, authenticated;
revoke all on table public.memory_versions from anon, authenticated;

notify pgrst, 'reload schema';
