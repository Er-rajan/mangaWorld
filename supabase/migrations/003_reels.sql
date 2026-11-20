begin;

create table public.reel_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position integer generated always as identity
);
create unique index reel_categories_name_idx on public.reel_categories (lower(name));
insert into public.reel_categories (name)
values ('Funny'), ('Fighting'), ('Emotional'), ('Behind the scenes'), ('Trailers');

create table public.reels (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  caption text not null default '' check (char_length(caption) <= 1000),
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  category_id uuid not null references public.reel_categories(id) on delete restrict,
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  chapter_path text check (chapter_path ~ '^(/series/[a-z0-9-]+|/read/[a-z0-9-]+/[a-z0-9-]+)$'),
  published boolean not null default false,
  position integer not null unique deferrable initially deferred,
  likes integer not null default 0 check (likes >= 0)
);
create index reels_category_idx on public.reels (category_id);
create table public.reel_likes (
  reel_id uuid references public.reels(id) on delete cascade,
  visitor uuid not null,
  primary key (reel_id, visitor)
);

alter table public.reel_categories enable row level security;
alter table public.reels enable row level security;
alter table public.reel_likes enable row level security;
revoke all on public.reel_categories, public.reels, public.reel_likes from public, anon, authenticated;
grant select on public.reel_categories, public.reels to anon, authenticated;
grant all on public.reel_categories, public.reels, public.reel_likes to service_role;
grant usage, select on sequence public.reel_categories_position_seq to service_role;
create policy "Read reel categories" on public.reel_categories for select to anon, authenticated using (true);
create policy "Read published reels" on public.reels for select to anon, authenticated using (published);

create function public.mutate_reels(operation text, payload jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  target uuid := (payload ->> 'id')::uuid;
  existing_position integer;
  adjacent_position integer;
  category uuid := (payload ->> 'category_id')::uuid;
  clip_tags text[] := array(select jsonb_array_elements_text(coalesce(payload -> 'tags', '[]'::jsonb)));
begin
  perform pg_advisory_xact_lock(721594);
  case operation
    when 'save' then
      if target is null then
        insert into public.reels (title, caption, youtube_id, category_id, tags, chapter_path, published, position)
        values (payload ->> 'title', payload ->> 'caption', payload ->> 'youtube_id', category, clip_tags,
          payload ->> 'chapter_path', (payload ->> 'published')::boolean,
          (select coalesce(max(position), 0) + 1 from public.reels)) returning id into target;
      else
        update public.reels set title = payload ->> 'title', caption = payload ->> 'caption',
          youtube_id = payload ->> 'youtube_id', category_id = category, tags = clip_tags,
          chapter_path = payload ->> 'chapter_path', published = (payload ->> 'published')::boolean where id = target;
        if not found then raise exception 'This reel was deleted.' using errcode = '22023'; end if;
      end if;
    when 'move' then
      select position into existing_position from public.reels where id = target;
      if payload ->> 'direction' = 'up' then
        select max(position) into adjacent_position from public.reels where position < existing_position;
      else
        select min(position) into adjacent_position from public.reels where position > existing_position;
      end if;
      if adjacent_position is not null then
        update public.reels set position = case when id = target then adjacent_position else existing_position end
          where position in (existing_position, adjacent_position);
      end if;
    when 'delete' then
      delete from public.reels where id = target;
    when 'save-category' then
      if target is null then
        insert into public.reel_categories (name) values (payload ->> 'name') returning id into target;
      else
        update public.reel_categories set name = payload ->> 'name' where id = target;
      end if;
    when 'delete-category' then
      delete from public.reel_categories where id = target;
    else raise exception 'Unknown reel action.' using errcode = '22023';
  end case;
  return target;
end;
$$;

create function public.react_to_reel(target uuid, browser uuid, desired boolean)
returns table (liked boolean, count integer)
language plpgsql set search_path = '' as $$
declare
  delta integer;
begin
  perform 1 from public.reels where id = target and published for update;
  if not found then return; end if;
  if desired then
    insert into public.reel_likes (reel_id, visitor) values (target, browser) on conflict do nothing;
    get diagnostics delta = row_count;
  else
    delete from public.reel_likes where reel_id = target and visitor = browser;
    get diagnostics delta = row_count;
    delta := -delta;
  end if;
  return query update public.reels set likes = likes + delta where id = target returning desired, likes;
end;
$$;

revoke all on function public.mutate_reels(text, jsonb), public.react_to_reel(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.mutate_reels(text, jsonb), public.react_to_reel(uuid, uuid, boolean) to service_role;

commit;
