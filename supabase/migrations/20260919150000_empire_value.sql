-- Empire value ledger. Current chapter total stays on chapters.economic_current.

create table if not exists public.empire_value_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  delta integer not null,
  value_after integer not null,
  note text,
  source public.record_source not null default 'USER',
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists empire_value_entries_player_at_idx
  on public.empire_value_entries (player_id, at);

insert into public.empire_value_entries (player_id, chapter_id, delta, value_after, note, source, at)
select
  cam.player_id,
  ch.id,
  0,
  ch.economic_current,
  'Startpunt hoofdstuk',
  'ADMIN',
  coalesce(ch.opened_at, ch.created_at)
from public.campaigns cam
join public.chapters ch on ch.id = cam.current_chapter_id
where cam.status = 'ACTIVE'
  and cam.deleted_at is null
  and ch.deleted_at is null
  and not exists (
    select 1 from public.empire_value_entries e
    where e.player_id = cam.player_id
  );

alter table public.empire_value_entries enable row level security;
revoke all on table public.empire_value_entries from anon, authenticated;

notify pgrst, 'reload schema';
