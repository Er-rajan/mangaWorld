import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reader } from "@/components/reader";
import { artUrl, chapterArt, chapterLink } from "@/lib/format";
import { getChapter, library } from "@/lib/db";
import { authorName } from "@/lib/brand";

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
  if (!chapter || !series) notFound();
  const index = series.chapters.findIndex((entry) => entry.id === id);
  const giscus = {
    repo: process.env.GISCUS_REPO ?? "", repoId: process.env.GISCUS_REPO_ID ?? "",
    category: process.env.GISCUS_CATEGORY ?? "", categoryId: process.env.GISCUS_CATEGORY_ID ?? "",
  };
  const comments = data.settings.comments && Object.values(giscus).every(Boolean) ? giscus : undefined;
  return <Reader key={id} series={series.title} seriesUrl={`/series/${series.slug}`} path={chapterLink(series, chapter)}
    chapter={chapter} prev={index > 0 ? chapterLink(series, series.chapters[index - 1]) : undefined}
    next={index + 1 < series.chapters.length ? chapterLink(series, series.chapters[index + 1]) : undefined}
    watermark={data.settings.watermark ? data.settings.author || authorName : ""} comments={comments} />;
}
