-- Progress scenarios on relationship snapshots + admin direction (service role only).

alter table public.nyx_relationship_snapshots
  add column if not exists progress_scenarios jsonb not null default '[]'::jsonb;

create table if not exists public.nyx_relationship_direction (
  player_id uuid primary key references public.players (id) on delete cascade,
  mode text not null default 'natural' check (mode in ('natural', 'guided')),
  scenario_id text,
  scenario_title text,
  scenario_summary text,
  source_snapshot_id uuid references public.nyx_relationship_snapshots (id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists nyx_relationship_direction_updated_at on public.nyx_relationship_direction;
create trigger nyx_relationship_direction_updated_at
  before update on public.nyx_relationship_direction
  for each row execute procedure public.set_updated_at();

alter table public.nyx_relationship_direction enable row level security;

revoke all on table public.nyx_relationship_direction from anon, authenticated;

notify pgrst, 'reload schema';
