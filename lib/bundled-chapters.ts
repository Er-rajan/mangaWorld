import { drownedCityChapter } from "./drowned-city";
import { rajanBackdrop, rajanChapters, rajanSlug } from "./rajan";
import type { Series } from "./types";

const chapters = [...rajanChapters, drownedCityChapter];

export function bundledChapter(slug: string, id: string) {
  return chapters.find((chapter) => chapter.series_id === slug && chapter.id === id);
}

export function latestBundledChapterNumber(slug: string) {
  return Math.max(0, ...chapters.filter((chapter) => chapter.series_id === slug).map((chapter) => chapter.number));
}

export function includeBundledChapters(series: Series): Series {
  const bundled = chapters.filter((chapter) => chapter.series_id === series.slug);
  if (!bundled.length) return series;
  const existing = new Set(series.chapters.map((chapter) => chapter.number));
  const included = bundled.filter((chapter) => !existing.has(chapter.number)).map(({ pages: _pages, ...chapter }) =>
    ({ ...chapter, series_id: series.id }));
  return {
    ...series,
    hero: series.hero ?? (series.slug === rajanSlug ? rajanBackdrop : undefined),
    cover_id: series.cover_id ?? bundled[0].cover_id,
    chapters: [...series.chapters, ...included].sort((a, b) => a.number - b.number),
  };
}
