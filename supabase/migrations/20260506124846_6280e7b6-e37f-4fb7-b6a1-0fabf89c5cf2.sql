
-- Voicetracks: in-browser DJ voice recording
create table if not exists public.voicetracks (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.stations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  notes text,
  storage_path text not null,
  mime_type text not null default 'audio/webm',
  duration_seconds numeric,
  file_size bigint,
  prev_media_id uuid references public.media_files(id) on delete set null,
  next_media_id uuid references public.media_files(id) on delete set null,
  scheduled_at timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voicetracks_station on public.voicetracks(station_id);
create index if not exists idx_voicetracks_created_by on public.voicetracks(created_by);

alter table public.voicetracks enable row level security;

create policy "voicetracks viewable by authenticated"
on public.voicetracks for select to authenticated using (true);

create policy "voicetracks editor insert"
on public.voicetracks for insert to authenticated
with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "voicetracks editor update"
on public.voicetracks for update to authenticated
using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create policy "voicetracks editor delete"
on public.voicetracks for delete to authenticated
using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'));

create trigger trg_voicetracks_updated
before update on public.voicetracks
for each row execute function public.set_updated_at();

-- Storage bucket for voicetrack audio blobs
insert into storage.buckets (id, name, public)
values ('voicetracks', 'voicetracks', false)
on conflict (id) do nothing;

create policy "voicetracks bucket read auth"
on storage.objects for select to authenticated
using (bucket_id = 'voicetracks');

create policy "voicetracks bucket write editor"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voicetracks'
  and (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'))
);

create policy "voicetracks bucket update editor"
on storage.objects for update to authenticated
using (
  bucket_id = 'voicetracks'
  and (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'))
);

create policy "voicetracks bucket delete editor"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voicetracks'
  and (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'admin'))
);
