begin;

alter table public.assets
  add column artwork jsonb,
  add column source_id uuid references public.assets(id),
  add column keep_source boolean not null default false,
  add column archived boolean not null default false;
alter table public.series add column hero_id uuid references public.assets(id);
create index on public.series (hero_id);
create index on public.assets (source_id);

-- A legacy cover's full rendition may be the best surviving source.
update public.assets a set keep_source = true where
  exists (select 1 from public.series s where s.cover_id = a.id)
  or exists (select 1 from public.chapters c where c.cover_id = a.id)
  or exists (select 1 from public.site_settings s cross join lateral jsonb_array_elements(s.characters) p
    where p ->> 'image_id' = a.id::text);

create function public.preserve_legacy_cover() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.assets set keep_source = true where id = new.cover_id and artwork is null and not keep_source;
  return new;
end;
$$;
create trigger preserve_series_cover after insert or update of cover_id on public.series
  for each row execute function public.preserve_legacy_cover();
create trigger preserve_chapter_cover after insert or update of cover_id on public.chapters
  for each row execute function public.preserve_legacy_cover();

create policy "Read public hero artwork" on public.assets for select to anon, authenticated using (
  not deleting and exists (select 1 from public.series s where s.hero_id = assets.id)
);

create function public.artwork_usage() returns bigint
language sql stable set search_path = '' as $$
  select coalesce(sum(case when metadata ->> 'size' ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end), 0)::bigint
  from storage.objects;
$$;

create function public.reserve_cover_art(info jsonb, reuse uuid) returns uuid
language plpgsql set search_path = '' as $$
declare
  owner_id uuid;
  target uuid;
begin
  perform pg_advisory_xact_lock(721593);
  -- Leave headroom for chapter uploads and signed transfers still in flight.
  if public.artwork_usage() + coalesce((info ->> 'bytes')::bigint, 0) > 900000000 then
    raise exception 'Project storage is near the free-tier limit. Clean up unused renditions before uploading.' using errcode = '22023';
  end if;
  if reuse is not null then
    select coalesce(a.source_id, a.id) into owner_id from public.assets a where a.id = reuse;
    if owner_id is null or not exists (select 1 from public.assets a join storage.objects o
      on o.bucket_id = 'manga-art' and o.name = a.id::text || case when a.artwork is null then '/full.webp' else '/master.webp' end
      where a.id = owner_id and (not a.deleting or a.keep_source)) then
      raise exception 'The saved source is unavailable. Choose a new image.' using errcode = '22023';
    end if;
    update public.assets set keep_source = true where id = owner_id;
  end if;
  insert into public.assets (artwork, source_id, keep_source) values (info, owner_id, owner_id is null)
    returning id into target;
  return target;
end;
$$;

create or replace function public.check_art(asset uuid) returns void
language plpgsql set search_path = '' as $$
declare
  entry public.assets;
  owner public.assets;
  required text[];
begin
  if asset is null then return; end if;
  select * into entry from public.assets where id = asset and not deleting and not archived;
  required := array[asset::text || '/full.webp'];
  if entry.artwork is null or (entry.artwork ->> 'thumb')::integer < (entry.artwork ->> 'width')::integer then
    required := array_append(required, asset::text || '/thumb.webp');
  end if;
  if entry.artwork is not null then
    if entry.artwork ? 'card' then required := array_append(required, asset::text || '/card.webp'); end if;
    select * into owner from public.assets where id = coalesce(entry.source_id, asset);
    required := array_append(required, owner.id::text || case when owner.artwork is null then '/full.webp' else '/master.webp' end);
  end if;
  if entry.id is null or (select count(*) from storage.objects where bucket_id = 'manga-art' and name = any(required)) <> cardinality(required) then
    raise exception 'Artwork upload incomplete or expired. Replace the affected image.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.save_series(payload jsonb, target uuid, expected integer) returns uuid
language plpgsql set search_path = '' as $$
declare
  cover uuid := (payload->>'cover_id')::uuid;
  hero uuid := (payload->>'hero_id')::uuid;
  named text := payload->>'title';
  tags_array text[] := array(select jsonb_array_elements_text(payload->'tags'));
begin
  perform pg_advisory_xact_lock(721593);
  perform public.check_art(cover);
  perform public.check_art(hero);
  if target is null then
    insert into public.series (slug, title, description, tags, status, cover_id, hero_id)
    values (coalesce(nullif(trim(both '-' from regexp_replace(lower(named), '[^a-z0-9]+', '-', 'g')), ''), 'series')
      || '-' || substr(gen_random_uuid()::text, 1, 12), named, payload->>'description', tags_array, payload->>'status', cover, hero)
    returning id into target;
  else
    update public.series set title = named, description = payload->>'description', tags = tags_array,
      status = payload->>'status', cover_id = cover,
      hero_id = case when payload ? 'hero_id' then hero else hero_id end, revision = revision + 1
      where id = target and revision = expected;
    if not found then raise exception 'Series changed in another tab. Reload and try again.' using errcode = '40001'; end if;
  end if;
  return target;
end;
$$;

create function public.unused_artwork() returns setof uuid
language sql stable set search_path = '' as $$
  select a.id from public.assets a where not a.archived and a.created_at < now() - interval '3 hours'
    and not exists (select 1 from public.series s where s.cover_id = a.id or s.hero_id = a.id)
    and not exists (select 1 from public.chapters c where c.cover_id = a.id)
    and not exists (select 1 from public.chapter_pages p where p.asset_id = a.id)
    and not exists (select 1 from public.site_settings s cross join lateral jsonb_array_elements(s.characters) p
      where p ->> 'image_id' = a.id::text);
$$;

-- Old deployments can keep cleaning page renditions while protected covers survive the rollout.
create or replace function public.claim_unused_art() returns setof uuid
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(721593);
  return query update public.assets a set deleting = true where a.id in (
    select b.id from public.assets b where not b.keep_source and b.artwork is null and b.id in (select public.unused_artwork())
    order by b.deleting desc, b.created_at limit 50
  ) returning a.id;
end;
$$;

create function public.claim_unused_artwork() returns table (id uuid, keep_source boolean, modern boolean, card boolean)
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(721593);
  return query update public.assets a set deleting = true where a.id in (
    select b.id from public.assets b where b.id in (select public.unused_artwork())
    order by b.deleting desc, b.created_at limit 50
  ) returning a.id, a.keep_source, a.artwork is not null, coalesce(a.artwork ? 'card', false);
end;
$$;

create function public.finish_artwork_cleanup(targets uuid[]) returns void
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(721593);
  update public.assets set archived = true, deleting = false where id = any(targets) and deleting and keep_source;
  delete from public.assets where id = any(targets) and deleting and not keep_source;
end;
$$;

revoke all on function public.preserve_legacy_cover(), public.reserve_cover_art(jsonb, uuid), public.artwork_usage(), public.unused_artwork(),
  public.claim_unused_artwork(), public.finish_artwork_cleanup(uuid[]) from public, anon, authenticated;
grant execute on function public.preserve_legacy_cover(), public.reserve_cover_art(jsonb, uuid), public.artwork_usage(), public.unused_artwork(),
  public.claim_unused_artwork(), public.finish_artwork_cleanup(uuid[]) to service_role;

commit;
