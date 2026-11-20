import type { Metadata } from "next";
import { ReelFeed } from "@/components/reel-feed";
import { library } from "@/lib/db";
import { reelCatalogue, reelLinks } from "@/lib/reels-server";

export const metadata: Metadata = { title: "Reels", description: "Short manga animations, trailers, and behind-the-scenes clips by Rajan.",
  alternates: { canonical: "/reels" } };
export const dynamic = "force-dynamic";

export default async function ReelsPage({ searchParams }: { searchParams: Promise<{ clip?: string }> }) {
  const [{ clips, categories, available }, { clip }, { series }] = await Promise.all([reelCatalogue(), searchParams, library()]);
  const publishedLinks = new Set(reelLinks(series).map((item) => item.path));
  return <main id="main" className="site-width reels-page">
    <ReelFeed clips={clips.map((item) => ({ ...item, chapter_path: item.chapter_path && publishedLinks.has(item.chapter_path)
      ? item.chapter_path : null }))} categories={categories} initial={clip} available={available} />
  </main>;
}
