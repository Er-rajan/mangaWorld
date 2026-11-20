import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesDetail } from "@/components/series-detail";
import { library, nextChapterRelease } from "@/lib/db";
import { artUrl, seriesLink } from "@/lib/format";
import { siteName } from "@/lib/brand";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const series = (await library()).series.find((entry) => entry.slug === slug);
  if (!series) return {};
  const { title } = series;
  const description = series.description || (series.chapters.length ? `Read ${title} on ${siteName}.` : "Chapters coming soon.");
  const image = series.cover_id ? artUrl(series.cover_id, "full") : series.hero ?? artUrl(null);
  return { title, description, alternates: { canonical: seriesLink(series) },
    openGraph: { title, description, images: [{ url: image, alt: `${title} artwork` }] } };
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const { series, settings, unavailable } = await library();
  const entry = series.find((series) => series.slug === slug);
  if (!entry && unavailable) throw new Error("The series is temporarily unavailable.");
  if (!entry) notFound();
  const profiles = settings.characters.filter((profile) => {
    const name = profile.series.trim().toLowerCase();
    return name === entry.slug || name === entry.title.toLowerCase();
  });
  return <SeriesDetail series={entry} profiles={profiles} scheduled={await nextChapterRelease(entry)} today={Date.now()} />;
}
