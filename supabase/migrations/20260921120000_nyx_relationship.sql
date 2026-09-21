-- Admin-only: Nyx relationship snapshots + daily media caps. Service role only.

create table if not exists public.nyx_relationship_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  trust_score integer not null check (trust_score >= 0 and trust_score <= 100),
  warmth_score integer not null check (warmth_score >= 0 and warmth_score <= 100),
  tension_score integer not null check (tension_score >= 0 and tension_score <= 100),
  intimacy_tier public.nyx_intimacy_tier,
  headline text not null,
  analysis text not null,
  highlights jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  run_id uuid references public.nyx_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists nyx_relationship_snapshots_player_created_idx
  on public.nyx_relationship_snapshots (player_id, created_at desc);

create table if not exists public.nyx_media_budget (
  player_id uuid primary key references public.players (id) on delete cascade,
  max_photos_per_day integer not null default 2 check (max_photos_per_day >= 0),
  max_videos_per_day integer not null default 1 check (max_videos_per_day >= 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists nyx_media_budget_updated_at on public.nyx_media_budget;
create trigger nyx_media_budget_updated_at
  before update on public.nyx_media_budget
  for each row execute procedure public.set_updated_at();

alter table public.nyx_relationship_snapshots enable row level security;
alter table public.nyx_media_budget enable row level security;

revoke all on table public.nyx_relationship_snapshots from anon, authenticated;
revoke all on table public.nyx_media_budget from anon, authenticated;

notify pgrst, 'reload schema';
