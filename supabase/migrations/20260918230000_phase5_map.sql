-- Phase 5: companies and custom map pins. RLS on; service role only.

do $$ begin
  create type public.map_pin_type as enum (
    'home','main','side','boss','contact','company','event','opportunity','saved'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  name text not null,
  sector text,
  lat double precision not null,
  lng double precision not null,
  note text,
  source public.record_source not null default 'ADMIN',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists companies_player_seed_uidx
  on public.companies (player_id, seed_key)
  where seed_key is not null and deleted_at is null;

create index if not exists companies_player_id_idx on public.companies (player_id);

create table if not exists public.map_pins (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  seed_key text,
  title text not null,
  pin_type public.map_pin_type not null default 'saved',
  lat double precision not null,
  lng double precision not null,
  note text,
  custom boolean not null default true,
  contact_id uuid references public.contacts (id) on delete set null,
  mission_id uuid references public.missions (id) on delete set null,
  source public.record_source not null default 'USER',
  locked_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists map_pins_player_seed_uidx
  on public.map_pins (player_id, seed_key)
  where seed_key is not null and deleted_at is null;

create index if not exists map_pins_player_id_idx on public.map_pins (player_id);

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
  before update on public.companies
  for each row execute procedure public.set_updated_at();

drop trigger if exists map_pins_updated_at on public.map_pins;
create trigger map_pins_updated_at
  before update on public.map_pins
  for each row execute procedure public.set_updated_at();

alter table public.companies enable row level security;
alter table public.map_pins enable row level security;

revoke all on table public.companies from anon, authenticated;
revoke all on table public.map_pins from anon, authenticated;

notify pgrst, 'reload schema';
