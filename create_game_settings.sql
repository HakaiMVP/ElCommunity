-- ============================================
-- Game Settings Table (per account)
-- ============================================

-- 1. Create the game_settings table
create table if not exists public.game_settings (
  id uuid references auth.users on delete cascade primary key,
  overlay_enabled boolean default true,
  overlay_mode text default 'minimal',
  overlay_position text default 'top-right',
  overlay_game_only boolean default false,
  show_fps boolean default true,
  show_cpu boolean default true,
  show_gpu boolean default true,
  show_ram boolean default true,
  show_disk boolean default true,
  updated_at timestamp with time zone default now()
);

-- 2. Enable RLS
alter table public.game_settings enable row level security;

-- 3. Create policies
create policy "Users can view their own game settings."
  on game_settings for select
  using ( auth.uid() = id );

create policy "Users can insert their own game settings."
  on game_settings for insert
  with check ( auth.uid() = id );

create policy "Users can update their own game settings."
  on game_settings for update
  using ( auth.uid() = id );

-- 4. Create an upsert function for convenience
create or replace function public.upsert_game_settings(
  p_overlay_enabled boolean default true,
  p_overlay_mode text default 'minimal',
  p_overlay_position text default 'top-right',
  p_overlay_game_only boolean default false,
  p_show_fps boolean default true,
  p_show_cpu boolean default true,
  p_show_gpu boolean default true,
  p_show_ram boolean default true,
  p_show_disk boolean default true
)
returns void as $$
begin
  insert into public.game_settings (id, overlay_enabled, overlay_mode, overlay_position, overlay_game_only, show_fps, show_cpu, show_gpu, show_ram, show_disk, updated_at)
  values (auth.uid(), p_overlay_enabled, p_overlay_mode, p_overlay_position, p_overlay_game_only, p_show_fps, p_show_cpu, p_show_gpu, p_show_ram, p_show_disk, now())
  on conflict (id) do update set
    overlay_enabled = excluded.overlay_enabled,
    overlay_mode = excluded.overlay_mode,
    overlay_position = excluded.overlay_position,
    overlay_game_only = excluded.overlay_game_only,
    show_fps = excluded.show_fps,
    show_cpu = excluded.show_cpu,
    show_gpu = excluded.show_gpu,
    show_ram = excluded.show_ram,
    show_disk = excluded.show_disk,
    updated_at = now();
end;
$$ language plpgsql security definer;
