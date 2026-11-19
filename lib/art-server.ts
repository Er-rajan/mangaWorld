import "server-only";
import { z } from "zod";
import { artBucket, database, hasDatabase } from "./db";

export async function serveArt(id: string, variant: string, admin = false) {
  if (!hasDatabase || !z.uuid().safeParse(id).success || !["full", "thumb"].includes(variant)) {
    return new Response(null, { status: 404 });
  }
  const { data, error } = await database(admin).from("assets").select("id").eq("id", id).eq("deleting", false).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!data) return new Response(null, { status: 404 });
  const result = await database(true).storage.from(artBucket).createSignedUrl(`${id}/${variant}.webp`, 600);
  if (result.error || !result.data) return new Response(null, { status: result.error?.name === "StorageApiError" ? 404 : 503 });
  return new Response(null, {
    status: 307, headers: { Location: result.data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
