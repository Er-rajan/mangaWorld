import type { Library, Settings } from "./types";

export const featuredSlug = "rajan-the-thor-curse";
export const defaultSettings: Settings = { author: "", about: "", watermark: false, comments: false, characters: [] };

export const starterLibrary: Library = {
  demo: true,
  settings: defaultSettings,
  series: [
    { slug: featuredSlug, title: "Rajan: The Thor Curse" },
    { slug: "the-drowned-city", title: "The Drowned City" },
  ].map(({ slug, title }) => ({
    id: slug, slug, title, description: "", tags: [], status: "ongoing", cover_id: null,
    revision: 1, created_at: "2026-11-19T00:00:00.000Z", chapters: [],
  })),
};
