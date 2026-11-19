import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { defaultSettings, starterLibrary } from "./starter";
import { drownedCityChapter, isBundledDrownedCityChapter, restoreDrownedCity } from "./drowned-city";
import type { Chapter, ChapterSummary, Library, PageArt, Series, Settings } from "./types";

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
export const hasDatabase = Boolean(url && publicKey && secret);
export const artBucket = "manga-art";
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
};

export function database(admin = false) {
  if (!hasDatabase) throw new Error("Configure Supabase using .env.example.");
  return createClient(url!, admin ? secret! : publicKey!, options);
}

export function ensure<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data == null) {
    console.error("Supabase request failed:", result.error);
    throw new Error("The library could not be loaded. Try again in a moment.");
  }
  return result.data;
}

type ChapterRow = Omit<ChapterSummary, "first_page"> & { chapter_pages: { asset_id: string }[] };

function toSummary({ chapter_pages, ...row }: ChapterRow): ChapterSummary {
  return { ...row, first_page: chapter_pages[0]?.asset_id ?? null };
}

async function listRows<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const items: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const rows = ensure(await read(from, from + size - 1));
    items.push(...rows);
    if (rows.length < size) return items;
  }
}

export const library = cache(async (admin = false): Promise<Library> => {
  if (!hasDatabase) return admin ? { series: [], settings: defaultSettings, demo: true } : starterLibrary;
  const client = database(admin);
  const [series, chapters, settings] = await Promise.all([
    listRows((from, to) => client.from("series").select("*").order("created_at").order("id").range(from, to)),
    listRows((from, to) => client.from("chapters").select("*, chapter_pages(asset_id)")
      .eq("chapter_pages.position", 1).order("number").order("id").range(from, to)),
    client.from("site_settings").select("author,about,watermark,comments,characters").eq("id", 1).single(),
  ]);
  const grouped = new Map<string, ChapterSummary[]>();
  for (const row of chapters as ChapterRow[]) {
    const list = grouped.get(row.series_id) ?? [];
    list.push(toSummary(row));
    grouped.set(row.series_id, list);
  }
  const currentSettings = ensure(settings) as Settings;
  if (!admin && !series.length && process.env.SHOW_DEMO_WHEN_EMPTY !== "false") {
    return { ...starterLibrary, settings: currentSettings };
  }
  const catalogue = series.map((row) => ({ ...row, chapters: grouped.get(row.id) ?? [] })) as Series[];
  return { series: admin ? catalogue : catalogue.map(restoreDrownedCity), settings: currentSettings, demo: false };
});

export const getChapter = cache(async (slug: string, id: string, admin = false): Promise<Chapter | undefined> => {
  const data = await library(admin);
  const summary = data.series.find((series) => series.slug === slug)?.chapters.find((chapter) => chapter.id === id);
  if (!summary) return undefined;
  if (!admin && isBundledDrownedCityChapter(slug, id)) return { ...summary, pages: drownedCityChapter.pages };
  if (data.demo) return undefined;
  const pages = ensure(await database(admin).from("chapter_pages").select("asset_id,width,height,filename,alt")
    .eq("chapter_id", id).order("position")) as PageArt[];
  return { ...summary, pages };
});

export async function backup() {
  return ensure(await database(true).rpc("export_library"));
}
