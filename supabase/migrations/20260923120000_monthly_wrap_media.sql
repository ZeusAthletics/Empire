alter table public.monthly_wraps
  add column if not exists media jsonb not null default '[]'::jsonb;
