begin;

create table public.chapter_comments (
  id integer generated always as identity primary key,
  chapter_path text not null check (chapter_path ~ '^/read/[a-z0-9-]+/[a-z0-9-]+$'),
  -- Bundled chapters have a reader path but no row in public.chapters.
  chapter_id uuid references public.chapters(id) on delete cascade,
  request_id uuid not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index chapter_comments_thread_idx on public.chapter_comments (chapter_path, id desc);
create index chapter_comments_chapter_idx on public.chapter_comments (chapter_id) where chapter_id is not null;

create table public.comment_attempts (
  source text primary key,
  window_start timestamptz not null,
  attempts integer not null
);

alter table public.chapter_comments enable row level security;
alter table public.comment_attempts enable row level security;
revoke all on public.chapter_comments, public.comment_attempts from public, anon, authenticated;
grant all on public.chapter_comments, public.comment_attempts to service_role;
grant usage on sequence public.chapter_comments_id_seq to service_role;

create function public.list_chapter_comments(thread_path text, target uuid, before_id integer, page_size integer)
returns table (id integer, name text, body text, created_at timestamptz)
language sql stable set search_path = '' as $$
  select c.id, c.name, c.body, c.created_at from public.chapter_comments c
  where c.chapter_path = thread_path and c.chapter_id is not distinct from target
    and (before_id is null or c.id < before_id)
    and exists (select 1 from public.site_settings where id = 1 and comments)
    and (target is null or exists (select 1 from public.chapters where id = target and published and release_at <= now()))
  order by c.id desc limit least(page_size, 51);
$$;

create function public.post_chapter_comment(
  thread_path text, target uuid, request_key uuid, display_name text, comment_body text, source_key text
)
returns table (id integer, name text, body text, created_at timestamptz)
language plpgsql set search_path = '' as $$
declare
  entry public.chapter_comments%rowtype;
  total integer;
begin
  perform 1 from public.site_settings s where s.id = 1 and s.comments for share;
  if not found then raise exception 'Comments are disabled.' using errcode = 'PT404'; end if;
  if target is not null then
    perform 1 from public.chapters c join public.series s on s.id = c.series_id
    where c.id = target and c.published and c.release_at <= now()
      and thread_path = '/read/' || s.slug || '/' || c.id::text for share of c, s;
    if not found then raise exception 'Chapter is unavailable.' using errcode = 'PT404'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 0));
  select * into entry from public.chapter_comments c where c.request_id = request_key;
  if found then
    if entry.chapter_path <> thread_path or entry.chapter_id is distinct from target
      or entry.name <> display_name or entry.body <> comment_body then
      raise exception 'Request was already used.' using errcode = 'PT409';
    end if;
  else
    if source_key is not null then
      delete from public.comment_attempts where window_start < now() - interval '1 day';
      insert into public.comment_attempts as a (source, window_start, attempts) values (source_key, now(), 1)
      on conflict (source) do update set
        attempts = case when a.window_start <= now() - interval '1 minute' then 1 else a.attempts + 1 end,
        window_start = case when a.window_start <= now() - interval '1 minute' then now() else a.window_start end
      returning attempts into total;
      if total > 5 then raise exception 'Too many comments.' using errcode = 'PT429'; end if;
    end if;
    insert into public.chapter_comments (chapter_path, chapter_id, request_id, name, body)
    values (thread_path, target, request_key, display_name, comment_body) returning * into entry;
  end if;
  return query select entry.id, entry.name, entry.body, entry.created_at;
end;
$$;

revoke all on function public.list_chapter_comments(text, uuid, integer, integer),
  public.post_chapter_comment(text, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.list_chapter_comments(text, uuid, integer, integer),
  public.post_chapter_comment(text, uuid, uuid, text, text, text) to service_role;

alter table public.site_settings alter column comments set default true;
update public.site_settings set comments = true where id = 1;

commit;
