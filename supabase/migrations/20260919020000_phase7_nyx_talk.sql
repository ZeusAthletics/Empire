-- Phase 7b: Nyx conversations and proposal seed keys. RLS on; service role only.

do $$ begin
  create type public.nyx_mode as enum ('COMPANION', 'ADVISOR', 'MISSION_CONTROL', 'DEBRIEF', 'OPPORTUNITY');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nyx_message_role as enum ('USER', 'NYX', 'SYSTEM');
exception when duplicate_object then null;
end $$;

alter table public.proposals add column if not exists seed_key text;

create unique index if not exists proposals_player_seed_uidx
  on public.proposals (player_id, seed_key)
  where seed_key is not null;

create table if not exists public.nyx_conversations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mode public.nyx_mode not null default 'MISSION_CONTROL',
  summary text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists nyx_conversations_player_id_idx on public.nyx_conversations (player_id);

create table if not exists public.nyx_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.nyx_conversations (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role public.nyx_message_role not null,
  content text not null,
  mode public.nyx_mode,
  run_id uuid references public.nyx_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists nyx_messages_conversation_id_idx on public.nyx_messages (conversation_id);

drop trigger if exists nyx_conversations_updated_at on public.nyx_conversations;
create trigger nyx_conversations_updated_at
  before update on public.nyx_conversations
  for each row execute procedure public.set_updated_at();

alter table public.nyx_conversations enable row level security;
alter table public.nyx_messages enable row level security;

revoke all on table public.nyx_conversations from anon, authenticated;
revoke all on table public.nyx_messages from anon, authenticated;

notify pgrst, 'reload schema';
