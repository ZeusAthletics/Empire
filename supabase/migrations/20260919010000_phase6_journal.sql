-- Phase 6: journal entries and monthly wraps. RLS on; service role only.

do $$ begin
  create type public.journal_extraction_status as enum ('PENDING', 'DONE', 'SKIPPED');
exception when duplicate_object then null;
end $$;

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  occurred_at timestamptz not null default now(),
  title text not null,
  body text not null,
  icon text not null default 'edit',
  tags text[] not null default '{}',
  contact_ids uuid[] not null default '{}',
  mission_id uuid references public.missions (id) on delete set null,
  location_name text,
  media jsonb not null default '[]'::jsonb,
  extra_media integer not null default 0,
  mood smallint,
  extraction_status public.journal_extraction_status not null default 'PENDING',
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint journal_entries_mood_chk check (mood is null or mood between 1 and 5)
);

create unique index if not exists journal_entries_player_seed_uidx
  on public.journal_entries (player_id, seed_key)
  where seed_key is not null and deleted_at is null;

create index if not exists journal_entries_player_occurred_idx
  on public.journal_entries (player_id, occurred_at desc);

create table if not exists public.monthly_wraps (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  month_id text not null,
  label text not null,
  year integer not null,
  events integer not null default 0,
  new_contacts integer not null default 0,
  missions_completed integer not null default 0,
  empire_delta integer not null default 0,
  deltas jsonb not null default '{}'::jsonb,
  biggest_win text not null,
  biggest_mistake text not null,
  best_relationship text not null,
  key_decision text not null,
  best_mission text not null,
  time_sink text not null,
  what_changed text not null,
  nyx text not null,
  generated_at timestamptz,
  entry_ids uuid[] not null default '{}',
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists monthly_wraps_player_month_uidx
  on public.monthly_wraps (player_id, month_id)
  where deleted_at is null;

create index if not exists monthly_wraps_player_id_idx on public.monthly_wraps (player_id);

drop trigger if exists journal_entries_updated_at on public.journal_entries;
create trigger journal_entries_updated_at
  before update on public.journal_entries
  for each row execute procedure public.set_updated_at();

drop trigger if exists monthly_wraps_updated_at on public.monthly_wraps;
create trigger monthly_wraps_updated_at
  before update on public.monthly_wraps
  for each row execute procedure public.set_updated_at();

alter table public.journal_entries enable row level security;
alter table public.monthly_wraps enable row level security;

revoke all on table public.journal_entries from anon, authenticated;
revoke all on table public.monthly_wraps from anon, authenticated;

notify pgrst, 'reload schema';
