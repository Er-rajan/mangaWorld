import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesDetail } from "@/components/series-detail";
import { library } from "@/lib/db";
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
  return { title, description, alternates: { canonical: seriesLink(series) },
    openGraph: { title, description, images: [{ url: artUrl(series.cover_id, "full"), alt: `${title} cover` }] } };
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const { series, unavailable } = await library();
  const entry = series.find((series) => series.slug === slug);
  if (!entry && unavailable) throw new Error("The series is temporarily unavailable.");
  if (!entry) notFound();
  return <SeriesDetail series={entry} today={Date.now()} />;
}
