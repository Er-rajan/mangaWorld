import type { Metadata } from "next";
import { ChapterRow } from "@/components/library";
import { library } from "@/lib/db";
import { isNew } from "@/lib/format";

export const metadata: Metadata = { title: "All chapters", alternates: { canonical: "/chapters" } };
export const dynamic = "force-dynamic";

export default async function ChaptersPage() {
  const { series } = await library();
  const now = Date.now();
  const chapters = series.flatMap((item) => item.chapters.map((chapter) => ({ item, chapter })))
    .sort((a, b) => Date.parse(b.chapter.release_at) - Date.parse(a.chapter.release_at));
  return <main id="main" className="site-width detail-page">
    <div className="section-heading"><h1>All chapters</h1></div>
    {chapters.length > 0 ? <div className="latest-list chapter-directory">
      {chapters.map(({ item, chapter }) => <ChapterRow key={`${item.id}/${chapter.id}`} series={item} chapter={chapter}
        today={now} libraryRow recent={isNew(chapter.release_at, now)} />)}
    </div> : <p className="empty-box">New chapters will appear here.</p>}
  </main>;
}
