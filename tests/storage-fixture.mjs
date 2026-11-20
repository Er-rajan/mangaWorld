import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { asRole, openDatabase } from "./database-fixture.mjs";

// Exercise the actual routes and SQL with a local PostgREST/Storage protocol fixture.
const db = await openDatabase();
await db.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
const files = new Map();
const tokens = new Map();
const rpc = {
  allow_admin_login: ["attempt_key"], save_series: ["payload", "target", "expected"],
  save_chapter: ["payload", "target", "expected"], track_chapter: ["target", "browser_id", "action", "reaction"],
  export_library: [], claim_unused_art: [], delete_entry: ["kind", "target", "expected"],
  next_chapter_release: ["series"],
  mutate_reels: ["operation", "payload"], react_to_reel: ["target", "browser", "desired"],
  reserve_cover_art: ["info", "reuse"], claim_unused_artwork: [], finish_artwork_cleanup: ["targets"], artwork_usage: [],
};

async function seedReader() {
  const names = ["midnight", "signal-1", "signal-2", "signal-3", "signal-4"];
  const art = await Promise.all(names.map(async (name) => ({
    id: randomUUID(),
    bytes: await readFile(new URL(`./artwork/${name}.webp`, import.meta.url)),
  })));
  const [cover, ...pages] = art;
  return asRole(db, "service_role", async (tx) => {
    for (const { id, bytes } of art) {
      const full = id + "/full.webp";
      const thumb = id + "/thumb.webp";
      await tx.query("insert into public.assets (id) values ($1)", [id]);
      await tx.query("insert into storage.objects values ('manga-art', $1), ('manga-art', $2)", [full, thumb]);
      files.set(full, bytes);
      files.set(thumb, bytes);
    }
    const series = (await tx.query(
      "insert into public.series (slug, title, tags, cover_id) values ('reader-fixture', 'Reader fixture', array['Sci-fi'], $1) returning *",
      [cover.id],
    )).rows[0];
    const chapters = [];
    for (const [index, title] of ["First fixture chapter", "Second fixture chapter"].entries()) {
      const chapter = {
        series_id: series.id, title, number: index + 1, note: "", cover_id: index === 0 ? cover.id : null,
        release_at: new Date(Date.now() - (2 - index) * 86400000).toISOString(), published: true,
        pages: pages.map(({ id }, position) => ({
          asset_id: id, filename: `page-${position + 1}.webp`, width: 768, height: 768, alt: "",
        })),
      };
      const id = (await tx.query("select public.save_chapter($1, null, 0) as id", [chapter])).rows[0].id;
      chapters.push({ ...chapter, id, first_page: chapter.pages[0].asset_id, revision: 1, likes: 0, views: 0 });
    }
    return { ...series, chapters };
  });
}

let readerFixture;

function respond(res, status, data, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Expose-Headers": "Content-Type", ...extra });
  res.end(data === undefined ? "" : JSON.stringify(data));
}

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3212");
  const path = url.pathname;
  const role = req.headers.apikey === "fixture-secret" ? "service_role" : "anon";
  const query = (sql, args) => asRole(db, role, (tx) => tx.query(sql, args));
  try {
    if (path === "/health") return respond(res, 200, { status: "ok" });
    if (path.startsWith("/rest/v1/") && req.headers.apikey === "fixture-invalid") {
      return respond(res, 401, { message: "Invalid API key" });
    }
    if (path === "/fixtures/reader" && req.method === "POST") return respond(res, 200, await (readerFixture ??= seedReader()));
    if (req.method === "OPTIONS") return respond(res, 204);
    if (path.startsWith("/storage/v1/")) {
      const signing = path.match(/^\/storage\/v1\/object\/(upload\/sign|sign)\/manga-art\/(.+)$/);
      if (!signing) return respond(res, 404, { message: "File not found" });
      const [, kind, key] = signing;
      if (req.method === "POST" && role === "service_role") {
        if (kind === "sign" && !files.has(key)) return respond(res, 404, { message: "File not found" });
        const token = randomUUID();
        tokens.set(token, { key, kind });
        const signed = `/object/${kind}/manga-art/${key}?token=${token}`;
        return respond(res, 200, kind === "sign" ? { signedURL: signed } : { url: signed });
      }
      const token = tokens.get(url.searchParams.get("token"));
      if (token?.key !== key || token.kind !== kind) return respond(res, 403, { message: "Invalid token" });
      if (req.method === "PUT" && kind === "upload/sign") {
        const form = await new Response(await read(req), { headers: { "Content-Type": req.headers["content-type"] } }).formData();
        const uploaded = form.get("");
        if (!(uploaded instanceof Blob) || uploaded.type !== "image/webp") return respond(res, 400, { message: "WebP required" });
        files.set(key, Buffer.from(await uploaded.arrayBuffer()));
        await asRole(db, "service_role", (tx) => tx.query("insert into storage.objects values ('manga-art', $1, $2)", [key, { size: uploaded.size }]));
        return respond(res, 200, { Key: "manga-art/" + key });
      }
      if (req.method === "GET" && kind === "sign" && files.has(key)) {
        res.writeHead(200, { "Content-Type": "image/webp", "Access-Control-Allow-Origin": "*" });
        return res.end(files.get(key));
      }
      return respond(res, 404, { message: "File not found" });
    }
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.split("/").at(-1);
      if (!Object.hasOwn(rpc, name)) return respond(res, 404);
      const body = JSON.parse((await read(req)).toString());
      const placeholders = rpc[name].map((_, i) => "$" + (i + 1)).join(",");
      const args = rpc[name].map((key) => body[key]);
      const set = ["track_chapter", "claim_unused_art", "next_chapter_release", "react_to_reel", "claim_unused_artwork"].includes(name);
      const rows = (await query(`select ${set ? "* from " : ""}public.${name}(${placeholders})${set ? "" : " as value"}`, args)).rows;
      return respond(res, 200, set ? (name === "claim_unused_art" ? rows.map((row) => row[name]) : rows) : rows[0].value);
    }
    if (!path.startsWith("/rest/v1/")) return respond(res, 404);
    const readId = url.searchParams.get("id")?.slice(3);
    const chapterId = url.searchParams.get("chapter_id")?.slice(3);
    let rows;
    switch (path.split("/").at(-1)) {
      case "assets": {
        const idFilter = url.searchParams.get("id");
        const selected = idFilter?.startsWith("in.(") ? idFilter.slice(4, -1).split(",") : null;
        rows = (await (req.method === "POST"
          ? query("insert into public.assets default values returning id")
          : selected ? query("select * from public.assets where id = any($1) and not deleting", [selected])
            : query("select * from public.assets where id = $1 and not deleting", [readId]))).rows;
        break;
      }
      case "series": rows = (await query("select * from public.series order by created_at, id")).rows; break;
      case "chapters":
        rows = (await query(`select c.*, coalesce((select json_agg(json_build_object('asset_id',p.asset_id))
          from public.chapter_pages p where p.chapter_id = c.id and p.position = 1), '[]') as chapter_pages
          from public.chapters c order by number, id`)).rows.map((row) => ({ ...row, number: Number(row.number) }));
        break;
      case "chapter_pages":
        rows = (await query("select asset_id,width,height,filename,alt from public.chapter_pages where chapter_id = $1 order by position", [chapterId])).rows;
        break;
      case "site_settings": rows = (await query("select author,about,watermark,comments,characters from public.site_settings")).rows; break;
      case "reels": rows = (await query("select * from public.reels order by position")).rows; break;
      case "reel_categories": rows = (await query("select id,name from public.reel_categories order by position")).rows; break;
      default: return respond(res, 404);
    }
    return respond(res, 200, req.headers.accept === "application/vnd.pgrst.object+json" ? rows[0] : rows);
  } catch (error) {
    return respond(res, 400, { message: error.message, code: error.code });
  }
});
server.listen(3212, "127.0.0.1");
