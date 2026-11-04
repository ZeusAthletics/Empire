-- Sticky intimate chat session flags on nyx_conversations (MISSION_CONTROL talk).

alter table public.nyx_conversations
  add column if not exists intimate_session_active boolean not null default false;

alter table public.nyx_conversations
  add column if not exists intimate_started_at timestamptz;

alter table public.nyx_conversations
  add column if not exists intimate_last_at timestamptz;

alter table public.nyx_conversations
  add column if not exists intimate_nonintimate_streak integer not null default 0;

notify pgrst, 'reload schema';
