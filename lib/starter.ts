import type { Library, Settings } from "./types";
import { authorName } from "./brand";
import { drownedCitySlug } from "./drowned-city";
import { includeBundledChapter } from "./bundled-chapters";
import { rajanSlug } from "./rajan";

export const featuredSlug = rajanSlug;
export const defaultSettings: Settings = { author: authorName, about: "", watermark: false, comments: false, characters: [] };

export const starterLibrary: Library = {
  demo: true,
  settings: defaultSettings,
  series: [
    { slug: featuredSlug, title: "Rajan: The Thor Curse" },
    { slug: drownedCitySlug, title: "The Drowned City" },
  ].map(({ slug, title }) => includeBundledChapter({
    id: slug, slug, title, description: "", tags: [], status: "ongoing", cover_id: null,
    revision: 1, created_at: "2026-11-19T00:00:00.000Z", chapters: [],
  })),
};
