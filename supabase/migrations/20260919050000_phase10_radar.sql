-- Phase 10: opportunity radar. RLS on; service role only.

do $$ begin
  create type public.opportunity_category as enum (
    'EVENT', 'PERSON', 'COMPANY', 'CONTENT', 'PROPERTY', 'ROLE', 'DEAL', 'OTHER'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.opportunity_source as enum (
    'MANUAL', 'CALENDAR', 'EVENT_FEED', 'NEWS', 'CONTACT', 'JOURNAL', 'NYX'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.opportunity_type as enum ('PERSONAL_INTEREST', 'STRATEGIC');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.opportunity_status as enum (
    'NEW', 'SEEN', 'SAVED', 'DISMISSED', 'CONVERTED_TO_SIDE_QUEST', 'EXPIRED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.opportunity_signal as enum (
    'VIEWED', 'SAVED', 'DISMISSED', 'CONVERTED', 'COMPLETED', 'IGNORED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  title text not null,
  summary text not null,
  category public.opportunity_category not null,
  source_type public.opportunity_source not null default 'MANUAL',
  source_id text,
  source_url text,
  discovered_at timestamptz not null default now(),
  available_from timestamptz,
  expires_at timestamptz,
  location_name text,
  lat double precision,
  lng double precision,
  relevance_score integer not null default 0,
  base_score integer not null default 0,
  score_adjustment integer not null default 0,
  score_breakdown jsonb not null default '{}',
  confidence public.confidence not null default 'LIKELY',
  reasons_for_relevance text[] not null default '{}',
  related_stats public.stat_key[] not null default '{}',
  related_contact_keys text[] not null default '{}',
  related_mission_ids uuid[] not null default '{}',
  strategic_value text,
  urgency text,
  type public.opportunity_type not null default 'STRATEGIC',
  campaign_changing boolean not null default false,
  status public.opportunity_status not null default 'NEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists opportunities_player_seed_uidx
  on public.opportunities (player_id, seed_key)
  where seed_key is not null;

create index if not exists opportunities_player_score_idx
  on public.opportunities (player_id, relevance_score desc);

create table if not exists public.opportunity_signals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  signal public.opportunity_signal not null,
  dwell_ms integer,
  at timestamptz not null default now()
);

create index if not exists opportunity_signals_player_idx on public.opportunity_signals (player_id);

drop trigger if exists opportunities_updated_at on public.opportunities;
create trigger opportunities_updated_at
  before update on public.opportunities
  for each row execute procedure public.set_updated_at();

alter table public.opportunities enable row level security;
alter table public.opportunity_signals enable row level security;

revoke all on table public.opportunities from anon, authenticated;
revoke all on table public.opportunity_signals from anon, authenticated;

notify pgrst, 'reload schema';
