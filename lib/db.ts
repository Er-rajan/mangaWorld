import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { defaultSettings, starterLibrary } from "./starter";
import { bundledChapter, includeBundledChapters } from "./bundled-chapters";
import type { Chapter, ChapterSummary, Library, PageArt, ScheduledRelease, Series, Settings } from "./types";
import type { Artwork } from "./artwork";

const url = process.env.SUPABASE_URL?.trim();
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
export const hasDatabase = Boolean(url && publicKey && secret);
export const artBucket = "manga-art";
const showStarter = process.env.SHOW_DEMO_WHEN_EMPTY !== "false";
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
};

export function database(admin = false) {
  if (!hasDatabase) throw new Error("Configure Supabase using .env.example.");
  return createClient(url!, admin ? secret! : publicKey!, options);
}

function ensure<T>(result: { data: T | null; error: unknown }, operation: string): T {
  if (result.error || result.data == null) {
    throw new Error(`Supabase ${operation} failed`, { cause: result.error ?? "Expected a database result" });
  }
  return result.data;
}

type ChapterRow = Omit<ChapterSummary, "first_page"> & { chapter_pages: { asset_id: string }[] };

function toSummary({ chapter_pages, ...row }: ChapterRow): ChapterSummary {
  return { ...row, first_page: chapter_pages[0]?.asset_id ?? null };
}

async function listRows<T>(operation: string, read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const items: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const rows = ensure(await read(from, from + size - 1), operation);
    items.push(...rows);
    if (rows.length < size) return items;
  }
}

async function loadCatalogue(admin: boolean): Promise<Library> {
  const client = database(admin);
  const [series, chapters, settings] = await Promise.all([
    listRows("reading series", (from, to) => client.from("series").select("*").order("created_at").order("id").range(from, to)),
    listRows("reading chapters", (from, to) => client.from("chapters").select("*, chapter_pages(asset_id)")
      .eq("chapter_pages.position", 1).order("number").order("id").range(from, to)),
    client.from("site_settings").select("author,about,watermark,comments,characters").eq("id", 1).single(),
  ]);
  const grouped = new Map<string, ChapterSummary[]>();
  for (const row of chapters as ChapterRow[]) {
    const list = grouped.get(row.series_id) ?? [];
    list.push(toSummary(row));
    grouped.set(row.series_id, list);
  }
  const currentSettings = ensure(settings, "reading site settings") as Settings;
  if (!admin && !series.length && showStarter) {
    return { ...starterLibrary, settings: currentSettings };
  }
  const catalogue = series.map((row) => ({ ...row, chapters: grouped.get(row.id) ?? [] })) as Series[];
  if (admin) return { series: catalogue, settings: currentSettings, demo: false };
  const details = await artworkDetails(catalogue.flatMap((item) => [item.cover_id, item.hero_id]));
  return { series: catalogue.map((item) => includeBundledChapters({ ...item,
    coverArtwork: item.cover_id ? details.get(item.cover_id) : undefined,
    heroArtwork: item.hero_id ? details.get(item.hero_id) : undefined,
  })), settings: currentSettings, demo: false };
}

export async function artworkDetails(ids: (string | null | undefined)[], admin = false) {
  const assets = [...new Set(ids.filter((id): id is string => Boolean(id && !id.startsWith("/"))))];
  const descriptions = new Map<string, Artwork>();
  if (!hasDatabase || !assets.length) return descriptions;
  const client = database(admin);
  for (let start = 0; start < assets.length; start += 80) {
    const { data, error } = await client.from("assets").select("id,artwork").in("id", assets.slice(start, start + 80));
    if (error) break; // The legacy renditions stay usable before the additive migration is applied.
    for (const row of data ?? []) if (row.artwork) descriptions.set(row.id, row.artwork as Artwork);
  }
  return descriptions;
}

export const library = cache(async (admin = false): Promise<Library> => {
  const empty: Library = { series: [], settings: defaultSettings, demo: true };
  if (!hasDatabase) return admin || !showStarter ? empty : starterLibrary;
  if (admin) return loadCatalogue(true);
  try {
    return await loadCatalogue(false);
  } catch (error) {
    console.error("Could not load the public catalogue from Supabase:", error);
    return { ...(showStarter ? starterLibrary : empty), unavailable: true };
  }
});

export const getChapter = cache(async (slug: string, id: string, admin = false): Promise<Chapter | undefined> => {
  const data = await library(admin);
  const summary = data.series.find((series) => series.slug === slug)?.chapters.find((chapter) => chapter.id === id);
  if (!summary) return undefined;
  const bundled = !admin && bundledChapter(slug, id);
  if (bundled) return { ...summary, pages: bundled.pages };
  if (data.demo) return undefined;
  const pages = ensure(await database(admin).from("chapter_pages").select("asset_id,width,height,filename,alt")
    .eq("chapter_id", id).order("position"), "reading chapter pages") as PageArt[];
  const coverArtwork = !admin && summary.cover_id ? (await artworkDetails([summary.cover_id])).get(summary.cover_id) : undefined;
  return { ...summary, pages, coverArtwork };
});

export async function nextChapterRelease(series: Series): Promise<ScheduledRelease | undefined> {
  if (!hasDatabase || series.id === series.slug) return undefined;
  const { data, error } = await database().rpc("next_chapter_release", { series: series.id });
  if (error && error.code !== "PGRST202") console.error("Could not load scheduled chapter release:", error);
  const next: ScheduledRelease | undefined = data?.[0];
  return next ? { ...next, number: Number(next.number) } : undefined;
}

export async function backup() {
  return ensure(await database(true).rpc("export_library"), "exporting the library");
}
