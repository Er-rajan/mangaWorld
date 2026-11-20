begin;

-- Scheduled chapters remain protected by the chapter and artwork policies.
create function public.next_chapter_release(series uuid)
returns table (number numeric, release_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.number, c.release_at from public.chapters c
  where c.series_id = series and c.published and c.release_at > now()
  order by c.release_at, c.number limit 1;
$$;
revoke all on function public.next_chapter_release(uuid) from public;
grant execute on function public.next_chapter_release(uuid) to anon, authenticated, service_role;

create function public.check_character_art() returns trigger
language plpgsql set search_path = '' as $$
declare
  profile jsonb;
begin
  perform pg_advisory_xact_lock(721593);
  for profile in select value from jsonb_array_elements(new.characters)
  loop
    perform public.check_art((profile ->> 'image_id')::uuid);
  end loop;
  return new;
end;
$$;
create trigger validate_character_art before update of characters on public.site_settings
  for each row execute function public.check_character_art();

create policy "Read public character art" on public.assets for select to anon, authenticated using (
  not deleting and exists (select 1 from public.site_settings s
    cross join lateral jsonb_array_elements(s.characters) as profile
    where profile ->> 'image_id' = assets.id::text)
);

create or replace function public.claim_unused_art() returns setof uuid
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(721593);
  return query update public.assets a set deleting = true where a.id in (
    select b.id from public.assets b where b.created_at < now() - interval '3 hours'
      and not exists (select 1 from public.series s where s.cover_id = b.id)
      and not exists (select 1 from public.chapters c where c.cover_id = b.id)
      and not exists (select 1 from public.chapter_pages p where p.asset_id = b.id)
      and not exists (select 1 from public.site_settings s cross join lateral jsonb_array_elements(s.characters) as profile
        where profile ->> 'image_id' = b.id::text)
    order by b.deleting desc, b.created_at limit 50
  ) returning a.id;
end;
$$;

commit;
