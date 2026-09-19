-- Street addresses for contacts and player Home Base.

alter table public.contacts
  add column if not exists address text;

alter table public.players
  add column if not exists home_address text,
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision;

notify pgrst, 'reload schema';
