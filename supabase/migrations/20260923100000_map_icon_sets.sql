-- Map marker icon sets (admin) + per-player marker icon choices.

create table if not exists public.map_icon_sets (
  slug text primary key,
  title text not null,
  active boolean not null default false,
  grid_cols integer not null check (grid_cols > 0),
  grid_rows integer not null check (grid_rows > 0),
  icon_count integer not null check (icon_count > 0),
  asset_path text not null,
  cell_width integer not null check (cell_width > 0),
  cell_height integer not null check (cell_height > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.player_map_marker_icons (
  player_id uuid not null references public.players (id) on delete cascade,
  marker_key text not null,
  icon_key text not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, marker_key)
);

drop trigger if exists player_map_marker_icons_updated_at on public.player_map_marker_icons;
create trigger player_map_marker_icons_updated_at
  before update on public.player_map_marker_icons
  for each row execute procedure public.set_updated_at();

insert into public.map_icon_sets (
  slug,
  title,
  active,
  grid_cols,
  grid_rows,
  icon_count,
  asset_path,
  cell_width,
  cell_height,
  sort_order
)
values (
  'part-1',
  'Empire icons — deel 1',
  true,
  10,
  10,
  100,
  '/map-icons/part-1/sheet.jpg',
  102,
  102,
  1
)
on conflict (slug) do update set
  title = excluded.title,
  grid_cols = excluded.grid_cols,
  grid_rows = excluded.grid_rows,
  icon_count = excluded.icon_count,
  asset_path = excluded.asset_path,
  cell_width = excluded.cell_width,
  cell_height = excluded.cell_height;

alter table public.map_icon_sets enable row level security;
alter table public.player_map_marker_icons enable row level security;

revoke all on table public.map_icon_sets from anon, authenticated;
revoke all on table public.player_map_marker_icons from anon, authenticated;

notify pgrst, 'reload schema';
