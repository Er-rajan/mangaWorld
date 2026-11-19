import { BrowseLibrary, ContinueReading, Hero } from "@/components/library";
import { library } from "@/lib/db";
import { artUrl } from "@/lib/format";
import { siteBanner, siteDescription, siteName } from "@/lib/brand";
import { featuredSlug } from "@/lib/starter";
import type { Series } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function featuredSeries(series: Series[]) {
  return series.find((entry) => entry.slug === featuredSlug) ?? series.find((entry) => entry.hero)
    ?? series.find((entry) => entry.chapters.length) ?? series[0];
}

export async function generateMetadata(): Promise<Metadata> {
  const featured = featuredSeries((await library()).series);
  return { alternates: { canonical: "/" }, openGraph: { title: siteName, description: siteDescription,
    images: [featured?.hero ?? (featured?.cover_id ? artUrl(featured.cover_id, "full") : siteBanner)], type: "website" } };
}

export default async function Home() {
  const { series } = await library();
  const featured = featuredSeries(series);
  return <main id="main" className="site-width content-gap">
    <Hero series={featured} />
    <ContinueReading series={series} />
    <BrowseLibrary series={series} today={Date.now()} />
  </main>;
}
