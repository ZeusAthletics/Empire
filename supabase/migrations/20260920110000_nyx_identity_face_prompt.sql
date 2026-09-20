-- Optional canonical face prompt text (admin-edited, used with FACE refs).

create table if not exists public.nyx_identity_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.nyx_identity_settings enable row level security;
revoke all on table public.nyx_identity_settings from anon, authenticated;

notify pgrst, 'reload schema';
