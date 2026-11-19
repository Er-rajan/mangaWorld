import Link from "next/link";
import { library } from "@/lib/db";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { chapterLink, seriesLink } from "@/lib/format";

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const { series } = await library();
  const search = series.flatMap((item) => [
    { url: seriesLink(item), title: item.title, subtitle: item.tags.join(" · ") || "Series", detail: item.description },
    ...item.chapters.map((chapter) => ({ url: chapterLink(item, chapter), title: chapter.title,
      subtitle: `${item.title} · Chapter ${chapter.number}`, detail: item.tags.join(" ") })),
  ]);
  return <>
    <SiteHeader search={search} />
    {children}
    <footer className="site-footer">
      <div className="site-width flex flex-wrap items-center justify-between gap-5">
        <Brand />
        <nav aria-label="Footer" className="flex items-center gap-5"><Link href="/about">About the author</Link><Link href="/admin">Admin</Link></nav>
      </div>
    </footer>
  </>;
}
