import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterProfiles } from "@/components/character-profiles";
import { library } from "@/lib/db";

export const metadata: Metadata = { title: "Character profiles", alternates: { canonical: "/characters" } };
export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const { settings: { characters } } = await library();
  if (!characters.length) notFound();
  return <main id="main" className="site-width detail-page shelf-page">
    <Link href="/about" className="back-link">About the author</Link>
    <h1>Character profiles</h1>
    <CharacterProfiles profiles={characters} showSeries />
  </main>;
}
