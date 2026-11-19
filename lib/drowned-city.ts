import type { Chapter, Series } from "./types";

export const drownedCitySlug = "the-drowned-city";
const artwork = `/manga/${drownedCitySlug}`;
const cover = `${artwork}/cover.webp`;
const pages = [
  "Rain falls over the city as a young courier looks across the rooftops.",
  "The courier approaches an illuminated train on the platform.",
  "Inside an empty carriage, a reflection stares back from the window.",
  "The train vanishes, leaving a light on at the deserted platform.",
].map((alt, index) => {
  const filename = `page-${index + 1}.webp`;
  return { asset_id: `${artwork}/${filename}`, filename, alt, width: 768, height: 768 };
});

export const drownedCityChapter: Chapter = {
  id: "chapter-1", series_id: drownedCitySlug, number: 1, title: "The Drowned City", note: "",
  release_at: "2026-11-11T00:00:00.000Z", published: true, cover_id: cover, revision: 1,
  likes: 0, views: 0, first_page: pages[0].asset_id, pages,
};

export function isBundledDrownedCityChapter(slug: string, id: string) {
  return slug === drownedCitySlug && id === drownedCityChapter.id;
}

export function restoreDrownedCity(series: Series): Series {
  if (series.slug !== drownedCitySlug) return series;
  const { pages: _pages, ...chapter } = drownedCityChapter;
  const chapters = series.chapters.some((entry) => entry.number === chapter.number) ? series.chapters
    : [{ ...chapter, series_id: series.id }, ...series.chapters].sort((a, b) => a.number - b.number);
  return { ...series, cover_id: series.cover_id ?? cover, chapters };
}

export function upcomingDrownedCityChapter(series: Series) {
  return series.slug === drownedCitySlug && series.status === "ongoing" && !series.chapters.some((entry) => entry.number >= 2)
    ? 2 : undefined;
}
