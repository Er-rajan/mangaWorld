import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, PenLine, Users } from "lucide-react";
import { library } from "@/lib/db";

export const metadata: Metadata = { title: "About the author", alternates: { canonical: "/about" } };
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const { settings } = await library();
  return <main id="main" className="site-width detail-page">
    <article className="about-card">
      <div>
        <span className="section-icon"><PenLine size={20} /></span>
        <h1>{settings.author || "About the author"}</h1>
        <p>{settings.about || "An independent manga library for original stories."}</p>
        <div className="detail-actions">
          <Link href="/" className="button primary"><BookOpen size={18} /> Browse the library</Link>
          {settings.characters.length > 0 && <Link href="/characters" className="button secondary"><Users size={18} /> Character profiles</Link>}
        </div>
      </div>
    </article>
  </main>;
}
