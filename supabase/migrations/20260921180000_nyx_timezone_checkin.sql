-- Player IANA timezone for Nyx local time; Mission Control check-in flag on messages.

alter table public.players
  add column if not exists timezone text not null default 'Europe/Brussels';

alter table public.nyx_messages
  add column if not exists is_check_in boolean not null default false;

create index if not exists nyx_messages_player_check_in_idx
  on public.nyx_messages (player_id, created_at desc)
  where is_check_in = true;

notify pgrst, 'reload schema';
