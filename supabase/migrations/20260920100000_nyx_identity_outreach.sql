-- Nyx identity vault, outreach run log, message media link.

do $$ begin
  create type public.nyx_identity_ref_role as enum (
    'FACE',
    'BODY',
    'SIGNATURE_OUTFIT',
    'VARIANT_OK'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nyx_outreach_action as enum ('SILENCE', 'TEXT', 'PHOTO', 'VIDEO');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nyx_intimacy_tier as enum ('EARLY', 'FRIEND', 'TRUST');
exception when duplicate_object then null;
end $$;

create table if not exists public.nyx_identity_refs (
  id uuid primary key default gen_random_uuid(),
  role public.nyx_identity_ref_role not null,
  storage_path text not null,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists nyx_identity_refs_role_idx on public.nyx_identity_refs (role);

create table if not exists public.nyx_outreach_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  action public.nyx_outreach_action not null,
  reason text not null,
  intimacy_tier public.nyx_intimacy_tier,
  media_id uuid references public.media_assets (id) on delete set null,
  message_id uuid references public.nyx_messages (id) on delete set null,
  run_id uuid references public.nyx_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists nyx_outreach_runs_player_created_idx
  on public.nyx_outreach_runs (player_id, created_at desc);

alter table public.nyx_messages
  add column if not exists media_id uuid references public.media_assets (id) on delete set null;

alter table public.nyx_identity_refs enable row level security;
alter table public.nyx_outreach_runs enable row level security;

revoke all on table public.nyx_identity_refs from anon, authenticated;
revoke all on table public.nyx_outreach_runs from anon, authenticated;

notify pgrst, 'reload schema';
