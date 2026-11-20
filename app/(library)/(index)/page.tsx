import { BrowseLibrary, ContinueReading, Hero } from "@/components/library";
import { library } from "@/lib/db";
import { artUrl } from "@/lib/format";
import { siteBanner, siteDescription, siteName } from "@/lib/brand";
import { featuredSlug } from "@/lib/starter";
import type { Series } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

function featuredSeries(series: Series[]) {
  const configured = [...new Set((process.env.FEATURED_SERIES ?? "").split(",").map((slug) => slug.trim()).filter(Boolean))]
    .flatMap((slug) => series.filter((item) => item.slug === slug));
  if (configured.length) return configured;
  const primary = series.find((entry) => entry.slug === featuredSlug) ?? series.find((entry) => entry.hero)
    ?? series.find((entry) => entry.chapters.length) ?? series[0];
  return primary ? [primary, ...series.filter((item) => item !== primary && item.hero)] : [];
}

export async function generateMetadata(): Promise<Metadata> {
  const [featured] = featuredSeries((await library()).series);
  return { alternates: { canonical: "/" }, openGraph: { title: siteName, description: siteDescription,
    images: [featured?.hero ?? (featured?.cover_id ? artUrl(featured.cover_id, "full") : siteBanner)], type: "website" } };
}

export default async function Home() {
  const { series } = await library();
  const featured = featuredSeries(series);
  return <main id="main" className="site-width content-gap">
    <Hero featured={featured} />
    <ContinueReading series={series} />
    <BrowseLibrary series={series} today={Date.now()} />
  </main>;
}
