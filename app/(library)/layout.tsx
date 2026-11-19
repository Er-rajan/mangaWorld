import Link from "next/link";
import { Instagram } from "lucide-react";
import { library } from "@/lib/db";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { chapterLink, seriesLink } from "@/lib/format";
import { authorName, instagramHandle, instagramUrl } from "@/lib/brand";

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
      <div className="site-width footer-inner">
        <div>
          <Brand />
          <p>Original manga by <Link href="/about">{authorName}</Link></p>
        </div>
        <nav aria-label="Footer">
          <Link href="/about">About the author</Link>
          <Link href="/admin">Admin</Link>
          <a className="button secondary instagram-link" href={instagramUrl} target="_blank" rel="noreferrer">
            <Instagram size={17} aria-hidden="true" /> <span>{instagramHandle}</span>
          </a>
        </nav>
      </div>
    </footer>
  </>;
}
