import type { ChapterSummary, Series } from "./types";

export const chapterLink = (series: Series, chapter: ChapterSummary) =>
  `/read/${series.slug}/${chapter.id}`;
export const seriesLink = (series: Series) => `/series/${series.slug}`;

export function artUrl(id: string | null | undefined, variant: "thumb" | "full" = "thumb", preview = false) {
  if (!id) return "/placeholder.webp";
  if (id.startsWith("/manga/")) return id;
  const path = `${id}/${variant}`;
  return preview ? `/api/admin/art/${path}` : `/api/art/${path}`;
}

export function chapterArt(series: Series, chapter: ChapterSummary) {
  return chapter.cover_id ?? chapter.first_page ?? series.cover_id;
}

export function readerThumbnail(id: string) {
  return id.startsWith("/manga/") ? id.replace(/\.webp$/, "-preview.webp") : artUrl(id, "thumb");
}

export function isNew(date: string, now = Date.now()) {
  const age = now - Date.parse(date);
  return age >= 0 && age < 14 * 86400000;
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(date));
}

const relativeDate = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const calendarDate = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "Asia/Kolkata" });

export const fullDate = (date: string) => calendarDate.format(new Date(date));

export function releaseAge(date: string, now: number) {
  const days = Math.trunc((Date.parse(date) - now) / 86_400_000);
  if (Math.abs(days) < 30) return relativeDate.format(days, "day");
  if (Math.abs(days) < 365) return relativeDate.format(Math.trunc(days / 30), "month");
  return relativeDate.format(Math.trunc(days / 365), "year");
}

export function latestReleasedChapter(chapters: ChapterSummary[]) {
  return chapters.reduce<ChapterSummary | undefined>((latest, chapter) => !latest
    || Date.parse(chapter.release_at) > Date.parse(latest.release_at)
    || (chapter.release_at === latest.release_at && chapter.number > latest.number) ? chapter : latest, undefined);
}

export function numberLabel(value: number) {
  return String(value).padStart(2, "0");
}

export function siteOrigin() {
  if (process.env.SITE_URL) return new URL(process.env.SITE_URL).origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
