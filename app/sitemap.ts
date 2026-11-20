import type { MetadataRoute } from "next";
import { library } from "@/lib/db";
import { chapterLink, seriesLink, siteOrigin } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { series, settings } = await library();
  const origin = siteOrigin();
  return ["/", "/about", "/chapters", "/reels", ...(settings.characters.length ? ["/characters"] : []),
    ...series.flatMap((item) => [seriesLink(item), ...item.chapters.map((entry) => chapterLink(item, entry))])]
    .map((path) => ({ url: origin + path }));
}
