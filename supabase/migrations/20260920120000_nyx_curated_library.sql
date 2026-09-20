-- Admin curated Nyx media (OpenArt stills/clips) for outreach picks. Each item send-once per player.

create table if not exists public.nyx_curated_media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  content_type text not null,
  media_type text not null check (media_type in ('PHOTO', 'VIDEO')),
  description text not null default '',
  min_intimacy_tier public.nyx_intimacy_tier not null default 'EARLY',
  label text,
  created_at timestamptz not null default now()
);

create index if not exists nyx_curated_media_tier_idx on public.nyx_curated_media (min_intimacy_tier);

create table if not exists public.nyx_curated_deliveries (
  id uuid primary key default gen_random_uuid(),
  curated_id uuid not null references public.nyx_curated_media (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  media_id uuid references public.media_assets (id) on delete set null,
  message_id uuid references public.nyx_messages (id) on delete set null,
  sent_at timestamptz not null default now(),
  unique (curated_id, player_id)
);

create index if not exists nyx_curated_deliveries_player_idx on public.nyx_curated_deliveries (player_id, sent_at desc);

alter table public.nyx_curated_media enable row level security;
alter table public.nyx_curated_deliveries enable row level security;
revoke all on table public.nyx_curated_media from anon, authenticated;
revoke all on table public.nyx_curated_deliveries from anon, authenticated;

notify pgrst, 'reload schema';
