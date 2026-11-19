import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Instagram, PenLine, Users } from "lucide-react";
import { library } from "@/lib/db";
import { authorName, instagramHandle, instagramUrl, siteBanner, siteName } from "@/lib/brand";

export const metadata: Metadata = { title: `About ${authorName}`, alternates: { canonical: "/about" } };
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const { settings } = await library();
  const author = settings.author || authorName;
  return <main id="main" className="site-width detail-page">
    <article className="about-card">
      <img className="about-banner" src={siteBanner} alt="" />
      <div>
        <span className="section-icon"><PenLine size={20} /></span>
        <h1>{author}</h1>
        <p>{settings.about || `${author} is the author of the original manga published on ${siteName}.`}</p>
        <div className="detail-actions">
          <Link href="/" className="button primary"><BookOpen size={18} /> Browse the library</Link>
          <a href={instagramUrl} className="button secondary" target="_blank" rel="noreferrer"><Instagram size={18} /> {instagramHandle}</a>
          {settings.characters.length > 0 && <Link href="/characters" className="button secondary"><Users size={18} /> Character profiles</Link>}
        </div>
      </div>
    </article>
  </main>;
}
