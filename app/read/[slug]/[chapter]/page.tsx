import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reader } from "@/components/reader";
import { artUrl, chapterArt, chapterLink } from "@/lib/format";
import { getChapter, hasDatabase, library } from "@/lib/db";
import { authorName } from "@/lib/brand";
import { upcomingDrownedCityChapter } from "@/lib/drowned-city";
import { bundledChapter } from "@/lib/bundled-chapters";
import { rajanSlug } from "@/lib/rajan";

type Props = { params: Promise<{ slug: string; chapter: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, chapter: id } = await params;
  const [chapter, data] = await Promise.all([getChapter(slug, id), library()]);
  const series = data.series.find((entry) => entry.slug === slug);
  if (!chapter || !series) return {};
  const title = `${chapter.title} · ${series.title}`;
  const description = `Read chapter ${chapter.number} of ${series.title}.`;
  return { title, description, alternates: { canonical: chapterLink(series, chapter) },
    openGraph: { title, description, images: [{ url: artUrl(chapterArt(series, chapter), "full"), alt: `${title} cover` }] } };
}

export default async function ChapterPage({ params }: Props) {
  const { slug, chapter: id } = await params;
  const [chapter, data] = await Promise.all([getChapter(slug, id), library()]);
  const series = data.series.find((entry) => entry.slug === slug);
  if ((!chapter || !series) && data.unavailable) throw new Error("The chapter is temporarily unavailable.");
  if (!chapter || !series) notFound();
  const index = series.chapters.findIndex((entry) => entry.id === id);
  const nextChapter = series.chapters[index + 1];
  return <Reader key={id} series={series.title} seriesUrl={`/series/${series.slug}`} path={chapterLink(series, chapter)}
    chapter={chapter} prev={index > 0 ? chapterLink(series, series.chapters[index - 1]) : undefined}
    next={nextChapter ? chapterLink(series, nextChapter) : undefined}
    nextArtwork={[nextChapter?.cover_id, nextChapter?.first_page].flatMap((asset) => asset ? [artUrl(asset, "full")] : [])}
    upcoming={upcomingDrownedCityChapter(series)} reactionsAvailable={!bundledChapter(slug, id)}
    defaultLayout={slug === rajanSlug ? { mode: "single", direction: "ltr" } : undefined}
    watermark={data.settings.watermark ? data.settings.author || authorName : ""}
    commentsEnabled={hasDatabase && data.settings.comments} />;
}
