
-- Per-station Stereo Tool configuration
create table if not exists public.stereo_tool_configs (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade unique,
  enabled boolean not null default false,
  integration_mode text not null default 'liquidsoap_lib'
    check (integration_mode in ('liquidsoap_lib','standalone')),
  bypass boolean not null default false,
  active_preset_id uuid,
  binary_path text,
  library_path text,
  license_key_secret_name text,
  input_source text,
  output_target text,
  sample_rate integer not null default 48000,
  latency_ms integer not null default 0,
  status text not null default 'unknown'
    check (status in ('unknown','stopped','starting','running','bypassed','error')),
  last_status_at timestamptz,
  status_message text,
  docker_volume_path text,
  custom_args text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stereo_tool_configs_station on public.stereo_tool_configs(station_id);

alter table public.stereo_tool_configs enable row level security;

create policy "stereo_tool_configs_select_auth" on public.stereo_tool_configs
  for select to authenticated using (true);
create policy "stereo_tool_configs_insert_admin" on public.stereo_tool_configs
  for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "stereo_tool_configs_update_admin" on public.stereo_tool_configs
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
create policy "stereo_tool_configs_delete_admin" on public.stereo_tool_configs
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create trigger trg_stereo_tool_configs_updated
before update on public.stereo_tool_configs
for each row execute function public.set_updated_at();

-- Preset registry (files live in mounted Docker volume; we store metadata only)
create table if not exists public.stereo_tool_presets (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  name text not null,
  description text,
  file_path text not null,
  file_size bigint,
  checksum text,
  uploaded_by uuid references auth.users(id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (station_id, name)
);

create index if not exists idx_stereo_tool_presets_station on public.stereo_tool_presets(station_id);

alter table public.stereo_tool_presets enable row level security;

create policy "stereo_tool_presets_select_auth" on public.stereo_tool_presets
  for select to authenticated using (true);
create policy "stereo_tool_presets_insert_admin" on public.stereo_tool_presets
  for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "stereo_tool_presets_update_admin" on public.stereo_tool_presets
  for update to authenticated using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));
create policy "stereo_tool_presets_delete_admin" on public.stereo_tool_presets
  for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create trigger trg_stereo_tool_presets_updated
before update on public.stereo_tool_presets
for each row execute function public.set_updated_at();

-- FK from config -> active preset (added after presets table exists)
alter table public.stereo_tool_configs
  add constraint stereo_tool_configs_active_preset_fk
  foreign key (active_preset_id) references public.stereo_tool_presets(id) on delete set null;

-- Event log
create table if not exists public.stereo_tool_events (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.stations(id) on delete cascade,
  event_type text not null,
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  message text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_stereo_tool_events_station on public.stereo_tool_events(station_id, created_at desc);

alter table public.stereo_tool_events enable row level security;

create policy "stereo_tool_events_select_auth" on public.stereo_tool_events
  for select to authenticated using (true);
create policy "stereo_tool_events_insert_editor" on public.stereo_tool_events
  for insert to authenticated with check (public.is_admin_or_editor(auth.uid()));
