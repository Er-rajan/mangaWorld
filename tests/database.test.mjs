import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { asRole, openDatabase } from "./database-fixture.mjs";

test("migration applies and schedules release, with draft metadata and art protected by RLS", async () => {
  const db = await openDatabase();
  const admin = (sql, args) => asRole(db, "service_role", (tx) => tx.query(sql, args));
  const reader = (sql, args) => asRole(db, "anon", (tx) => tx.query(sql, args));
  const asset = randomUUID();
  const visitor = randomUUID();
  try {
    const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
    await db.exec(seed);
    await db.exec(seed);
    const titles = await reader("select title from public.series order by title");
    assert.deepEqual(titles.rows.map(({ title }) => title), ["Rajan: The Thor Curse", "The Drowned City"]);
    const settings = await reader("select author from public.site_settings");
    assert.equal(settings.rows[0].author, "Rajan");
    const bucket = await db.query("select public, allowed_mime_types from storage.buckets where id = 'manga-art'");
    assert.deepEqual(bucket.rows, [{ public: false, allowed_mime_types: ["image/webp"] }]);
    const series = (await admin("select public.save_series($1, null, 0) as id", [{
      title: "Test series", description: "", tags: ["Drama"], status: "ongoing", cover_id: null,
    }])).rows[0].id;
    await admin("insert into public.assets (id) values ($1)", [asset]);
    const pages = [{ asset_id: asset, width: 300, height: 450, filename: "manga.webp", alt: "" }];
    const payload = { series_id: series, title: "Scheduled chapter", number: 1, note: "", cover_id: null,
      release_at: new Date(Date.now() + 60000).toISOString(), published: true, pages };
    const save = (data, target = null, expected = 0) => admin("select public.save_chapter($1, $2, $3) as id", [data, target, expected]);
    await assert.rejects(save(payload), /Artwork upload incomplete/);
    await admin("insert into storage.objects values ('manga-art', $1), ('manga-art', $2)", [asset + "/full.webp", asset + "/thumb.webp"]);
    const target = (await save(payload)).rows[0].id;
    assert.deepEqual((await reader("select id from public.chapters")).rows, []);
    assert.deepEqual((await reader("select asset_id from public.chapter_pages")).rows, []);
    assert.deepEqual((await reader("select id from public.assets")).rows, []);
    const schedule = (await reader("select * from public.next_chapter_release($1)", [series])).rows[0];
    assert.equal(Number(schedule.number), 1);
    assert.equal(new Date(schedule.release_at).toISOString(), payload.release_at);
    assert.deepEqual((await admin("select * from public.track_chapter($1, $2, 'view', false)", [target, visitor])).rows, []);
    await assert.rejects(reader("insert into public.series (title) values ('Unauthorised')"), /permission denied/);
    await assert.rejects(reader("select public.export_library()"), /permission denied/);
    await assert.rejects(save(payload, target, 0), /changed in another tab/);

    // Freeze the scheduled timestamp, then evaluate the next read in a later transaction.
    await admin("update public.chapters set release_at = clock_timestamp() + interval '300 milliseconds' where id = $1", [target]);
    assert.deepEqual((await reader("select id from public.chapters")).rows, []);
    await new Promise((resolve) => setTimeout(resolve, 330));
    assert.deepEqual((await reader("select id from public.chapters")).rows, [{ id: target }]);
    assert.deepEqual((await reader("select asset_id from public.chapter_pages")).rows, [{ asset_id: asset }]);
    assert.deepEqual((await reader("select id from public.assets")).rows, [{ id: asset }]);
    const stat = (action, like) => admin("select * from public.track_chapter($1, $2, $3, $4)", [target, visitor, action, like]);
    assert.deepEqual((await stat("view", false)).rows[0], { views: 1, likes: 0, liked: false });
    assert.deepEqual((await stat("view", false)).rows[0], { views: 1, likes: 0, liked: false });
    assert.deepEqual((await stat("like", true)).rows[0], { views: 1, likes: 1, liked: true });
    assert.deepEqual((await stat("like", false)).rows[0], { views: 1, likes: 0, liked: false });
    const backup = (await admin("select public.export_library() as metadata")).rows[0].metadata;
    assert.equal(backup.pages[0].asset_id, asset);

    await save({ ...payload, pages: [], published: false }, target, 1);
    assert.deepEqual((await reader("select id from public.chapters")).rows, []);
    await admin("update public.assets set created_at = now() - interval '4 hours' where id = $1", [asset]);
    await admin("update public.site_settings set characters = $1 where id = 1", [JSON.stringify([{ name: "Test portrait", image_id: asset }])]);
    assert.deepEqual((await reader("select id from public.assets")).rows, [{ id: asset }]);
    assert.deepEqual((await admin("select public.claim_unused_art() as id")).rows, []);
    await admin("update public.site_settings set characters = '[]' where id = 1");
    assert.deepEqual((await admin("select public.claim_unused_art() as id")).rows, [{ id: asset }]);
    await assert.rejects(save(payload, target, 2), /Artwork upload incomplete or expired/);
    await admin("select public.delete_entry('chapter', $1, 2)", [target]);
    assert.equal((await admin("select id from public.chapters")).rows.length, 0);
  } finally { await db.close(); }
});

test("each visitor can like a published reel once and hidden reels stay private", async () => {
  const db = await openDatabase();
  const admin = (sql, args) => asRole(db, "service_role", (tx) => tx.query(sql, args));
  const reader = (sql, args) => asRole(db, "anon", (tx) => tx.query(sql, args));
  try {
    const category_id = (await reader("select id from public.reel_categories order by position limit 1")).rows[0].id;
    const reel = { title: "Test reel", caption: "", youtube_id: "M7lc1UVf-VE", category_id, published: false };
    const id = (await admin("select public.mutate_reels('save', $1) as id", [reel])).rows[0].id;
    const visitor = randomUUID();
    const like = (desired) => admin("select * from public.react_to_reel($1, $2, $3)", [id, visitor, desired]);
    assert.deepEqual((await reader("select id from public.reels")).rows, []);
    assert.deepEqual((await like(true)).rows, []);
    await admin("select public.mutate_reels('save', $1)", [{ ...reel, id, published: true }]);
    assert.deepEqual((await like(true)).rows, [{ liked: true, count: 1 }]);
    assert.deepEqual((await like(true)).rows, [{ liked: true, count: 1 }]);
    assert.deepEqual((await like(false)).rows, [{ liked: false, count: 0 }]);
    await assert.rejects(reader("select visitor from public.reel_likes"), /permission denied/);
  } finally { await db.close(); }
});

test("artwork reprocessing retains the legacy source and enforces the storage ceiling", async () => {
  const db = await openDatabase();
  const admin = (sql, args) => asRole(db, "service_role", (tx) => tx.query(sql, args));
  try {
    const cover = randomUUID();
    await admin("insert into public.assets (id) values ($1)", [cover]);
    await admin("insert into storage.objects values ('manga-art', $1), ('manga-art', $2)", [`${cover}/full.webp`, `${cover}/thumb.webp`]);
    const series = { title: "Retained cover", status: "ongoing", description: "", tags: [], cover_id: cover };
    const target = (await admin("select public.save_series($1, null, 0) as id", [series])).rows[0].id;
    const info = { width: 341, thumb: 341, bytes: 1500 };
    const newCover = (await admin("select public.reserve_cover_art($1, $2) as id", [info, cover])).rows[0].id;
    await admin("insert into storage.objects values ('manga-art', $1)", [`${newCover}/full.webp`]);
    await admin("select public.save_series($1, $2, 1)", [{ ...series, cover_id: newCover }, target]);
    await admin("update public.assets set created_at = now() - interval '4 hours' where id = $1", [cover]);
    assert.deepEqual((await admin("select public.claim_unused_art() as id")).rows, []);
    assert.deepEqual((await admin("select * from public.claim_unused_artwork()")).rows, [{ id: cover, keep_source: true, modern: false, card: false }]);
    await admin("delete from storage.objects where name = $1", [`${cover}/thumb.webp`]);
    await admin("select public.finish_artwork_cleanup($1)", [[cover]]);
    assert.deepEqual((await admin("select name from storage.objects where name like $1", [`${cover}/%`])).rows, [{ name: `${cover}/full.webp` }]);
    assert.deepEqual((await admin("select archived from public.assets where id = $1", [cover])).rows, [{ archived: true }]);
    await admin("insert into storage.objects values ('manga-art', 'quota-test', '{\"size\":900000000}')");
    await assert.rejects(admin("select public.reserve_cover_art($1, null)", [info]), /storage is near the free-tier limit/);
  } finally { await db.close(); }
});
