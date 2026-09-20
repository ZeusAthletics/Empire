-- Player has "seen" Nyx outbound media in chat (FAB badge).

alter table public.nyx_messages
  add column if not exists seen_at timestamptz;

create index if not exists nyx_messages_unseen_media_idx
  on public.nyx_messages (player_id, created_at desc)
  where role = 'NYX' and media_id is not null and seen_at is null;

notify pgrst, 'reload schema';
