begin;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deleting boolean not null default false
);
create table public.series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default gen_random_uuid()::text,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  tags text[] not null default '{}',
  status text not null default 'ongoing' check (status in ('ongoing','completed')),
  cover_id uuid references public.assets(id),
  revision integer not null default 1,
  created_at timestamptz not null default now()
);
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  number numeric(8,2) not null check (number >= 0),
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '',
  release_at timestamptz not null default now(),
  published boolean not null default false,
  cover_id uuid references public.assets(id),
  views integer not null default 0,
  likes integer not null default 0,
  revision integer not null default 1,
  unique (series_id, number)
);
create table public.chapter_pages (
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  position integer not null check (position between 1 and 250),
  asset_id uuid not null references public.assets(id),
  width integer not null check (width between 1 and 6000),
  height integer not null check (height between 1 and 6000),
  filename text not null check (char_length(filename) between 1 and 255),
  alt text not null default '',
  primary key (chapter_id, position)
);
create index on public.chapter_pages (asset_id);
create index on public.series (cover_id);
create index on public.chapters (cover_id);
create index on public.chapters (release_at desc) where published;
create table public.site_settings (
  id integer primary key default 1 check (id = 1),
  author text not null default '',
  about text not null default '',
  watermark boolean not null default false,
  comments boolean not null default false,
  characters jsonb not null default '[]' check (jsonb_typeof(characters) = 'array')
);
insert into public.site_settings default values;
create table public.chapter_visitors (
  chapter_id uuid references public.chapters(id) on delete cascade,
  visitor uuid not null,
  last_view date,
  liked boolean not null default false,
  primary key (chapter_id, visitor)
);
create table public.login_attempts (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null
);

alter table public.assets enable row level security;
alter table public.series enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_pages enable row level security;
alter table public.site_settings enable row level security;
alter table public.chapter_visitors enable row level security;
alter table public.login_attempts enable row level security;

revoke all on public.assets, public.series, public.chapters, public.chapter_pages,
  public.site_settings, public.chapter_visitors, public.login_attempts from anon, authenticated;
grant select on public.assets, public.series, public.chapters, public.chapter_pages, public.site_settings to anon, authenticated;
grant all on public.assets, public.series, public.chapters, public.chapter_pages,
  public.site_settings, public.chapter_visitors, public.login_attempts to service_role;

create policy "Read series" on public.series for select to anon, authenticated using (true);
create policy "Read released chapters" on public.chapters for select to anon, authenticated
  using (published and release_at <= now());
create policy "Read released pages" on public.chapter_pages for select to anon, authenticated
  using (exists (select 1 from public.chapters c where c.id = chapter_id));
create policy "Read public asset references" on public.assets for select to anon, authenticated using (
  not deleting and (
    exists (select 1 from public.series s where s.cover_id = assets.id)
    or exists (select 1 from public.chapters c where c.cover_id = assets.id)
    or exists (select 1 from public.chapter_pages p where p.asset_id = assets.id)
  )
);
create policy "Read site settings" on public.site_settings for select to anon, authenticated using (true);

-- Clients receive exact, time-limited upload/read capabilities. No anon Storage policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manga-art', 'manga-art', false, 8000000, array['image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.check_art(asset uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if asset is not null and (
    not exists (select 1 from public.assets where id = asset and not deleting)
    or (select count(*) from storage.objects where bucket_id = 'manga-art'
      and name in (asset::text || '/full.webp', asset::text || '/thumb.webp')) <> 2
  ) then
    raise exception 'Artwork upload incomplete or expired. Replace the affected image.' using errcode = '22023';
  end if;
end;
$$;

create function public.save_series(payload jsonb, target uuid, expected integer) returns uuid
language plpgsql set search_path = '' as $$
declare
  cover uuid := (payload->>'cover_id')::uuid;
  named text := payload->>'title';
  tags_array text[] := array(select jsonb_array_elements_text(payload->'tags'));
begin
  perform pg_advisory_xact_lock(721593);
  perform public.check_art(cover);
  if target is null then
    insert into public.series (slug, title, description, tags, status, cover_id)
    values (coalesce(nullif(trim(both '-' from regexp_replace(lower(named), '[^a-z0-9]+', '-', 'g')), ''), 'series')
      || '-' || substr(gen_random_uuid()::text, 1, 12),
      named, payload->>'description', tags_array, payload->>'status', cover)
    returning id into target;
  else
    update public.series set title = named, description = payload->>'description', tags = tags_array,
      status = payload->>'status', cover_id = cover, revision = revision + 1
      where id = target and revision = expected;
    if not found then raise exception 'Series changed in another tab. Reload and try again.' using errcode = '40001'; end if;
  end if;
  return target;
end;
$$;

create function public.save_chapter(payload jsonb, target uuid, expected integer) returns uuid
language plpgsql set search_path = '' as $$
declare
  cover uuid := (payload->>'cover_id')::uuid;
  live boolean := (payload->>'published')::boolean;
  pages jsonb := payload->'pages';
  page jsonb;
begin
  perform pg_advisory_xact_lock(721593);
  if live and jsonb_array_length(pages) = 0 then
    raise exception 'Add at least one page before publishing.' using errcode = '22023';
  end if;
  perform public.check_art(cover);
  for page in select value from jsonb_array_elements(pages) loop
    perform public.check_art((page->>'asset_id')::uuid);
  end loop;
  if target is null then
    insert into public.chapters (series_id, number, title, note, release_at, published, cover_id)
    values ((payload->>'series_id')::uuid, (payload->>'number')::numeric, payload->>'title',
      payload->>'note', (payload->>'release_at')::timestamptz, live, cover)
    returning id into target;
  else
    update public.chapters set number = (payload->>'number')::numeric, title = payload->>'title',
      note = payload->>'note', release_at = (payload->>'release_at')::timestamptz,
      published = live, cover_id = cover, revision = revision + 1
      where id = target and series_id = (payload->>'series_id')::uuid and revision = expected;
    if not found then raise exception 'Chapter changed in another tab. Reload and try again.' using errcode = '40001'; end if;
    delete from public.chapter_pages where chapter_id = target;
  end if;
  insert into public.chapter_pages (chapter_id, position, asset_id, width, height, filename, alt)
    select target, position, (p->>'asset_id')::uuid, (p->>'width')::integer,
      (p->>'height')::integer, p->>'filename', p->>'alt'
      from jsonb_array_elements(pages) with ordinality as list(p, position);
  return target;
end;
$$;

create function public.delete_entry(kind text, target uuid, expected integer) returns void
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(721593);
  if kind = 'series' then
    delete from public.series where id = target and revision = expected;
  elsif kind = 'chapter' then
    delete from public.chapters where id = target and revision = expected;
  else
    raise exception 'Unknown entry type.' using errcode = '22023';
  end if;
  if not found then raise exception 'Entry changed in another tab. Reload and try again.' using errcode = '40001'; end if;
end;
$$;

-- Upload tokens last two hours. Keep unused objects until those tokens have expired.
create function public.claim_unused_art() returns setof uuid
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(721593);
  return query update public.assets a set deleting = true where a.id in (
    select b.id from public.assets b where b.created_at < now() - interval '3 hours'
      and not exists (select 1 from public.series s where s.cover_id = b.id)
      and not exists (select 1 from public.chapters c where c.cover_id = b.id)
      and not exists (select 1 from public.chapter_pages p where p.asset_id = b.id)
    order by b.deleting desc, b.created_at limit 50
  ) returning a.id;
end;
$$;

create function public.allow_admin_login(attempt_key text) returns boolean
language plpgsql set search_path = '' as $$
declare
  total integer;
begin
  delete from public.login_attempts where window_start < now() - interval '1 day';
  insert into public.login_attempts as a (key, window_start, attempts) values (attempt_key, now(), 1)
  on conflict (key) do update set
    attempts = case when a.window_start < now() - interval '15 minutes' then 1 else least(a.attempts + 1, 1000) end,
    window_start = case when a.window_start < now() - interval '15 minutes' then now() else a.window_start end
  returning attempts into total;
  return total <= 12;
end;
$$;

create function public.track_chapter(target uuid, browser_id uuid, action text, reaction boolean)
returns table (views integer, likes integer, liked boolean)
language plpgsql set search_path = '' as $$
declare
  entry public.chapters%rowtype;
  reader public.chapter_visitors%rowtype;
  today date := (now() at time zone 'UTC')::date;
begin
  select * into entry from public.chapters c where c.id = target and c.published and c.release_at <= now() for update;
  if not found then return; end if;
  insert into public.chapter_visitors (chapter_id, visitor) values (target, browser_id) on conflict do nothing;
  select * into reader from public.chapter_visitors v where v.chapter_id = target and v.visitor = browser_id;
  if action = 'view' and reader.last_view is distinct from today then
    update public.chapter_visitors v set last_view = today where v.chapter_id = target and v.visitor = browser_id;
    update public.chapters c set views = c.views + 1 where c.id = target returning * into entry;
  elsif action = 'like' and reader.liked is distinct from reaction then
    update public.chapter_visitors v set liked = reaction where v.chapter_id = target and v.visitor = browser_id;
    update public.chapters c set likes = c.likes + case when reaction then 1 else -1 end
      where c.id = target returning * into entry;
    reader.liked := reaction;
  end if;
  return query select entry.views, entry.likes, reader.liked;
end;
$$;

create function public.export_library() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'version', 1, 'exportedAt', now(), 'storageBucket', 'manga-art',
    'settings', (select to_jsonb(s) - 'id' from public.site_settings s where id = 1),
    'series', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at, s.id) from public.series s), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(to_jsonb(c) order by c.series_id, c.number) from public.chapters c), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(to_jsonb(p) order by p.chapter_id, p.position) from public.chapter_pages p), '[]'::jsonb),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) - 'deleting' order by a.id) from public.assets a where not deleting), '[]'::jsonb)
  );
$$;

revoke execute on function public.check_art(uuid), public.save_series(jsonb, uuid, integer),
  public.save_chapter(jsonb, uuid, integer), public.delete_entry(text, uuid, integer),
  public.claim_unused_art(), public.allow_admin_login(text), public.track_chapter(uuid, uuid, text, boolean), public.export_library()
  from public, anon, authenticated;
grant execute on function public.check_art(uuid), public.save_series(jsonb, uuid, integer), public.save_chapter(jsonb, uuid, integer),
  public.delete_entry(text, uuid, integer), public.claim_unused_art(), public.allow_admin_login(text),
  public.track_chapter(uuid, uuid, text, boolean), public.export_library() to service_role;

commit;
