import { cookies } from "next/headers";
import { adminConfigured, createSession, isAdmin, safeEqual, sameOrigin, sessionCookie, sessionSeconds, sign } from "@/lib/admin-auth";
import { adminAction } from "@/lib/admin-schema";
import { artBucket, database } from "@/lib/db";

const json = (data: object, status = 200) => Response.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!adminConfigured()) return json({ error: "The admin environment is incomplete." }, 503);
  const body = await request.text();
  if (body.length > 300000) return json({ error: "Metadata is too large." }, 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return json({ error: "Invalid JSON." }, 400); }
  const parsed = adminAction.safeParse(input);
  if (!parsed.success) return json({ error: parsed.error.issues[0].message }, 400);

  const requestData = parsed.data;
  const db = database(true);
  const jar = await cookies();
  if (requestData.action === "login") {
    const ip = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0] : "local";
    const limit = await db.rpc("allow_admin_login", { attempt_key: sign(`login:${ip ?? "unknown"}`) });
    if (limit.error) return json({ error: "Sign-in is temporarily unavailable." }, 503);
    if (!limit.data) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    const usernameMatches = safeEqual(requestData.username, process.env.ADMIN_USERNAME!);
    const passwordMatches = safeEqual(requestData.password, process.env.ADMIN_PASSWORD!);
    if (!usernameMatches || !passwordMatches) return json({ error: "Incorrect username or password." }, 401);
    jar.set(sessionCookie, createSession(), { httpOnly: true, secure: new URL(request.url).protocol === "https:" || process.env.VERCEL === "1",
      sameSite: "strict", path: "/", maxAge: sessionSeconds });
    return json({ ok: true });
  }
  if (!await isAdmin()) return json({ error: "Sign in again to continue." }, 401);
  if (requestData.action === "logout") {
    jar.delete(sessionCookie);
    return json({ ok: true });
  }
  if (requestData.action === "artwork-info") {
    const record = await db.from("assets").select("*").eq("id", requestData.id).maybeSingle();
    if (!record.data) return json({ error: "This artwork is unavailable." }, 404);
    return json({ artwork: record.data.artwork ?? null });
  }
  if (requestData.action === "upload" || requestData.action === "upload-cover") {
    const cover = requestData.action === "upload-cover" ? requestData : undefined;
    let id: string;
    if (cover) {
      const record = await db.rpc("reserve_cover_art", { info: cover.artwork, reuse: cover.reuse });
      if (record.error || !record.data) return json({ error: record.error?.code === "22023" ? record.error.message
        : "Could not reserve the cover. Apply artwork migration 004 in Supabase and try again." }, 502);
      id = record.data;
    } else {
      const record = await db.from("assets").insert({}).select("id").single();
      if (record.error) return json({ error: "Could not reserve an upload." }, 502);
      id = record.data.id;
    }
    const variants = ["full"];
    if (!cover || cover.artwork.thumb < cover.artwork.width) variants.push("thumb");
    if (cover?.artwork.card) variants.push("card");
    if (cover && !cover.reuse) variants.push("master");
    const bucket = db.storage.from(artBucket);
    const signed = await Promise.all(variants.map(async (variant) => {
      const { data } = await bucket.createSignedUploadUrl(`${id}/${variant}.webp`);
      return [variant, data?.signedUrl] as const;
    }));
    if (signed.some(([, url]) => !url)) return json({ error: "Could not sign the artwork upload." }, 502);
    return json({ id, ...Object.fromEntries(signed) });
  }
  if (requestData.action === "cleanup") {
    const claimed = await db.rpc("claim_unused_artwork");
    if (claimed.error) return json({ error: "Could not identify unused uploads." }, 502);
    const items = claimed.data as { id: string; keep_source: boolean; modern: boolean; card: boolean }[];
    if (!items.length) return json({ removed: 0 });
    const filenames = items.flatMap(({ id, keep_source, modern, card }) => [
      `${id}/thumb.webp`, ...(modern || !keep_source ? [`${id}/full.webp`] : []), ...(card ? [`${id}/card.webp`] : []),
    ]);
    const removed = await db.storage.from(artBucket).remove(filenames);
    if (removed.error) return json({ error: "Storage cleanup failed. Run it again to resume." }, 502);
    const finished = await db.rpc("finish_artwork_cleanup", { targets: items.map(({ id }) => id) });
    if (finished.error) return json({ error: "Cleanup could not finish. Run it again to resume." }, 502);
    return json({ removed: items.length });
  }

  let result;
  if (requestData.action === "delete") {
    result = await db.rpc("delete_entry", { kind: requestData.kind, target: requestData.id, expected: requestData.revision });
  } else if (requestData.action === "settings") {
    result = await db.from("site_settings").update(requestData.payload).eq("id", 1);
  } else {
    result = await db.rpc(requestData.action === "series" ? "save_series" : "save_chapter", {
      payload: requestData.payload, target: requestData.id, expected: requestData.revision,
    });
  }

  if (result.error) {
    const { code, message } = result.error;
    if (code === "23505") return json({ error: "This chapter number is already used in the series." }, 409);
    if (code === "40001" || code === "22023") return json({ error: message }, 409);
    console.error("Admin mutation failed:", result.error);
    return json({ error: "Could not save the change. Try again." }, 502);
  }
  return json({ ok: true, id: result.data });
}
