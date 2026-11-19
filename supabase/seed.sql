-- Apply after the schema migration to make the starter entries editable in the admin.
insert into public.series (slug, title)
values ('rajan-the-thor-curse', 'Rajan: The Thor Curse'),
       ('the-drowned-city', 'The Drowned City')
on conflict (slug) do nothing;

update public.site_settings set author = 'Rajan' where id = 1 and author = '';
