-- Phase 11: personas, media, admin access log. RLS on; service role only.

do $$ begin
  create type public.persona_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
exception when duplicate_object then null;
end $$;

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  version integer not null,
  status public.persona_status not null default 'DRAFT',
  name text not null default 'Nyx',
  address text not null default 'u',
  compiled_prompt text not null,
  compiled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists personas_active_uidx
  on public.personas (status)
  where status = 'ACTIVE';

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  storage_path text not null,
  kind text not null default 'image',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_player_id_idx on public.media_assets (player_id);

create table if not exists public.admin_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_player_id uuid not null references public.players (id) on delete cascade,
  scoped_player_id uuid not null references public.players (id) on delete cascade,
  path text not null,
  at timestamptz not null default now()
);

alter table public.personas enable row level security;
alter table public.media_assets enable row level security;
alter table public.admin_access_log enable row level security;

revoke all on table public.personas from anon, authenticated;
revoke all on table public.media_assets from anon, authenticated;
revoke all on table public.admin_access_log from anon, authenticated;

do $$ begin
  insert into storage.buckets (id, name, public)
  values ('empire-media', 'empire-media', false);
exception when others then null;
end $$;

notify pgrst, 'reload schema';
