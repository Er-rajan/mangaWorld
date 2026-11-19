import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { library } from "@/lib/db";

export const metadata: Metadata = { title: "Character profiles", alternates: { canonical: "/characters" } };
export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const { settings: { characters } } = await library();
  if (!characters.length) notFound();
  return <main id="main" className="site-width detail-page shelf-page">
    <Link href="/about" className="back-link">About the author</Link>
    <h1>Character profiles</h1>
    <div className="profile-grid">
      {characters.map((profile, index) => <article className="admin-panel" key={index}>
        <span className="section-icon"><Users size={20} /></span>
        <h2>{profile.name}</h2>
        {profile.series && <strong>{profile.series}</strong>}
        {profile.bio && <p>{profile.bio}</p>}
      </article>)}
    </div>
  </main>;
}
