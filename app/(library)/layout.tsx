import Link from "next/link";
import { Instagram } from "lucide-react";
import { library } from "@/lib/db";
import { Brand } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { CatalogueNotice } from "@/components/catalogue-notice";
import { chapterLink, seriesLink } from "@/lib/format";
import { authorName, instagramHandle, instagramUrl } from "@/lib/brand";

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  const { series, unavailable } = await library();
  const search = series.flatMap((item) => [
    { url: seriesLink(item), title: item.title, subtitle: item.tags.join(" · ") || "Series", detail: item.description },
    ...item.chapters.map((chapter) => ({ url: chapterLink(item, chapter), title: chapter.title,
      subtitle: `${item.title} · Chapter ${chapter.number}`, detail: item.tags.join(" ") })),
  ]);
  return <>
    <SiteHeader search={search} />
    {unavailable && <CatalogueNotice />}
    {children}
    <footer className="site-footer">
      <div className="site-width footer-inner">
        <div>
          <Brand />
          <p>© {authorName}</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/">Home</Link>
          <Link href="/#series">Manga</Link>
          <Link href="/about" aria-label="About the author">About</Link>
          <Link href="/admin">Admin</Link>
          <a className="button secondary instagram-link" href={instagramUrl} target="_blank" rel="noreferrer">
            <Instagram size={17} aria-hidden="true" /> <span>Instagram <span className="sr-only">{instagramHandle}</span></span>
          </a>
          <a href="#top" className="button secondary">Back to top</a>
        </nav>
      </div>
    </footer>
  </>;
}
