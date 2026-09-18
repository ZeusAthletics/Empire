-- Phase 3: campaign, chapter, stat history. RLS on; the Next.js server uses the service role.

do $$ begin
  create type public.record_source as enum ('AI', 'ADMIN', 'USER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.campaign_status as enum ('ACTIVE', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.chapter_status as enum ('LOCKED', 'ACTIVE', 'COMPLETED');
exception when duplicate_object then null;
end $$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  title text not null,
  north_star text not null,
  current_chapter_id uuid,
  bottleneck_stat public.stat_key not null,
  bottleneck_set_at timestamptz not null default now(),
  bottleneck_reason text not null,
  status public.campaign_status not null default 'ACTIVE',
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  index integer not null,
  roman text not null,
  name text not null,
  tagline text not null,
  economic_from integer not null,
  economic_to integer not null,
  economic_current integer not null,
  exit_criteria text[] not null default '{}',
  status public.chapter_status not null default 'LOCKED',
  opened_at timestamptz,
  closed_at timestamptz,
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$ begin
  alter table public.campaigns
    add constraint campaigns_current_chapter_id_fkey
    foreign key (current_chapter_id) references public.chapters (id);
exception
  when duplicate_object then null;
end $$;

create unique index if not exists campaigns_one_active_per_player
  on public.campaigns (player_id)
  where status = 'ACTIVE' and deleted_at is null;

create unique index if not exists chapters_campaign_index_uidx
  on public.chapters (campaign_id, index)
  where deleted_at is null;

create index if not exists campaigns_player_id_idx on public.campaigns (player_id);
create index if not exists chapters_player_id_idx on public.chapters (player_id);
create index if not exists chapters_campaign_id_idx on public.chapters (campaign_id);

create table if not exists public.stat_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  key public.stat_key not null,
  value integer not null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists stat_snapshots_player_key_day_uidx
  on public.stat_snapshots (player_id, key, ((at at time zone 'utc')::date));

create index if not exists stat_snapshots_player_id_idx on public.stat_snapshots (player_id);

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute procedure public.set_updated_at();

drop trigger if exists chapters_updated_at on public.chapters;
create trigger chapters_updated_at
  before update on public.chapters
  for each row execute procedure public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.chapters enable row level security;
alter table public.stat_snapshots enable row level security;

revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.chapters from anon, authenticated;
revoke all on table public.stat_snapshots from anon, authenticated;

notify pgrst, 'reload schema';
