-- Phase 1: player + stats. RLS on; the Next.js server uses the service role.

create extension if not exists vector;
create extension if not exists pgcrypto;

do $$ begin
  create type public.role as enum ('PLAYER', 'ADMIN');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.stat_key as enum (
    'capital', 'income', 'ownership', 'network',
    'authority', 'strategy', 'execution', 'optionality'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.role not null default 'PLAYER',
  display_name text not null,
  title text not null,
  level integer not null default 1,
  xp integer not null default 0,
  xp_to_next integer not null default 1000,
  lifetime_xp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.stat_values (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  key public.stat_key not null,
  value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (player_id, key)
);

create index if not exists stat_values_player_id_idx on public.stat_values (player_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists players_updated_at on public.players;
create trigger players_updated_at
  before update on public.players
  for each row execute procedure public.set_updated_at();

drop trigger if exists stat_values_updated_at on public.stat_values;
create trigger stat_values_updated_at
  before update on public.stat_values
  for each row execute procedure public.set_updated_at();

alter table public.players enable row level security;
alter table public.stat_values enable row level security;

revoke all on table public.players from anon, authenticated;
revoke all on table public.stat_values from anon, authenticated;

notify pgrst, 'reload schema';
