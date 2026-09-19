-- Phase 9: patterns, notification interrupts. RLS on; service role only.

do $$ begin
  create type public.pattern_status as enum (
    'OBSERVING', 'SURFACED', 'CONFIRMED', 'DISMISSED', 'RESOLVED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pattern_impact as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
exception when duplicate_object then null;
end $$;

create table if not exists public.strategic_patterns (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  title text not null,
  description text not null,
  evidence_refs jsonb not null default '[]',
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  confidence public.confidence not null default 'LIKELY',
  strategic_impact public.pattern_impact not null default 'MEDIUM',
  related_stats public.stat_key[] not null default '{}',
  related_memory_ids uuid[] not null default '{}',
  status public.pattern_status not null default 'OBSERVING',
  surfaced_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists strategic_patterns_player_seed_uidx
  on public.strategic_patterns (player_id, seed_key)
  where seed_key is not null;

create index if not exists strategic_patterns_player_id_idx on public.strategic_patterns (player_id);

create table if not exists public.notification_interrupts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);

create index if not exists notification_interrupts_player_at_idx
  on public.notification_interrupts (player_id, at desc);

drop trigger if exists strategic_patterns_updated_at on public.strategic_patterns;
create trigger strategic_patterns_updated_at
  before update on public.strategic_patterns
  for each row execute procedure public.set_updated_at();

alter table public.strategic_patterns enable row level security;
alter table public.notification_interrupts enable row level security;

revoke all on table public.strategic_patterns from anon, authenticated;
revoke all on table public.notification_interrupts from anon, authenticated;

notify pgrst, 'reload schema';
