import { drownedCityChapter } from "./drowned-city";
import { rajanChapter } from "./rajan";
import type { Series } from "./types";

const chapters = [rajanChapter, drownedCityChapter];

export function bundledChapter(slug: string, id?: string) {
  return chapters.find((chapter) => chapter.series_id === slug && (id === undefined || chapter.id === id));
}

export function includeBundledChapter(series: Series): Series {
  const bundled = bundledChapter(series.slug);
  if (!bundled) return series;
  const { pages: _pages, ...chapter } = bundled;
  const entries = series.chapters.some((entry) => entry.number === chapter.number) ? series.chapters
    : [{ ...chapter, series_id: series.id }, ...series.chapters].sort((a, b) => a.number - b.number);
  return { ...series, cover_id: series.cover_id ?? chapter.cover_id, chapters: entries };
}
