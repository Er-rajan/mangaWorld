import "server-only";
import { database, hasDatabase } from "./db";
import { chapterLink, seriesLink } from "./format";
import type { Reel, ReelCategory, ReelLink } from "./reels";
import type { Series } from "./types";

export async function reelCatalogue(admin = false) {
  const empty = { clips: [] as Reel[], categories: [] as ReelCategory[] };
  if (!hasDatabase) return { ...empty, available: false };
  const client = database(admin);
  const clips = client.from("reels").select("id,title,caption,youtube_id,category_id,tags,chapter_path,published,likes").order("position");
  if (!admin) clips.eq("published", true);
  const [reels, categories] = await Promise.all([clips, client.from("reel_categories").select("id,name").order("position")]);
  if (reels.error || categories.error) return { ...empty, available: false };
  return { clips: reels.data as Reel[], categories: categories.data as ReelCategory[], available: true };
}

export function reelLinks(series: Series[]): ReelLink[] {
  return series.flatMap((item) => [{ path: seriesLink(item), title: item.title }, ...item.chapters.map((chapter) => ({
    path: chapterLink(item, chapter), title: `${item.title} · ${chapter.title}`,
  }))]);
}
