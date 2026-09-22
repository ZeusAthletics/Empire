-- Admin-only intimacy axes on relationship snapshots (never exposed to player APIs).

alter table public.nyx_relationship_snapshots
  add column if not exists admin_intimacy_profile jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
