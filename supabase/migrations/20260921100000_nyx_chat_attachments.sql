-- Player uploads / links in Nyx chat (Mission Control).

alter table public.nyx_messages
  add column if not exists linked_url text;

alter table public.nyx_messages
  add column if not exists attachment_context text;

create index if not exists nyx_messages_user_media_idx
  on public.nyx_messages (player_id, created_at desc)
  where role = 'USER' and media_id is not null;

notify pgrst, 'reload schema';
