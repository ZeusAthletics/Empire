-- Ephemeral Nyx phone-call sessions (turns never enter nyx_messages).

create table if not exists public.nyx_phone_calls (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  conversation_id uuid references public.nyx_conversations (id) on delete set null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'ENDED', 'MISSED', 'QUOTA')),
  credit_level text not null default 'ok'
    check (credit_level in ('ok', 'low', 'empty')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nyx_phone_calls_player_active_idx
  on public.nyx_phone_calls (player_id, status, started_at desc);

create table if not exists public.nyx_phone_turns (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.nyx_phone_calls (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role text not null check (role in ('USER', 'NYX')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists nyx_phone_turns_call_idx
  on public.nyx_phone_turns (call_id, created_at asc);

alter table public.nyx_phone_calls enable row level security;
alter table public.nyx_phone_turns enable row level security;

notify pgrst, 'reload schema';
