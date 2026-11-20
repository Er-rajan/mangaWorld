import "server-only";
import { z } from "zod";
import { artBucket, database, hasDatabase } from "./db";

export async function serveArt(id: string, variant: string, admin = false) {
  if (!hasDatabase || !z.uuid().safeParse(id).success || !["full", "thumb", "card", ...(admin ? ["master"] : [])].includes(variant)) {
    return new Response(null, { status: 404 });
  }
  const { data, error } = await database(admin).from("assets").select("*").eq("id", id).eq("deleting", false).maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!data || (data.archived && variant !== "master")) return new Response(null, { status: 404 });
  const service = database(true);
  let owner = data;
  if (variant === "master" && data.source_id) {
    const source = await service.from("assets").select("*").eq("id", data.source_id).maybeSingle();
    if (!source.data) return new Response(null, { status: source.error ? 503 : 404 });
    owner = source.data;
  }
  const useFull = (variant === "card" && !data.artwork?.card)
    || (variant === "thumb" && data.artwork && data.artwork.thumb === data.artwork.width);
  const file = variant === "master" ? owner.artwork ? "master" : "full" : useFull ? "full" : variant;
  const result = await service.storage.from(artBucket).createSignedUrl(`${owner.id}/${file}.webp`, 600);
  if (result.error || !result.data) return new Response(null, { status: result.error?.name === "StorageApiError" ? 404 : 503 });
  return new Response(null, {
    status: 307, headers: { Location: result.data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
