import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { artworkSpecs, bundledArtwork, undersized, type ArtworkKind } from "@/lib/artwork";
import { artworkDetails, database, library } from "@/lib/db";
import { siteBanner } from "@/lib/brand";
import { rajanBackdrop } from "@/lib/rajan";
import { drownedCityChapter } from "@/lib/drowned-city";

type Entry = { id: string; name: string; kind: ArtworkKind; href?: string };

export default async function ArtworkAdmin() {
  if (!await isAdmin()) redirect("/admin");
  const { series } = await library(true);
  const entries: Entry[] = [];
  for (const item of series) {
    const href = `/admin/series/${item.id}`;
    if (item.cover_id) entries.push({ id: item.cover_id, kind: "cover", name: `${item.title} cover`, href });
    if (item.hero_id) entries.push({ id: item.hero_id, kind: "hero", name: `${item.title} hero`, href });
    for (const chapter of item.chapters) {
      if (chapter.cover_id) entries.push({ id: chapter.cover_id, kind: "cover", name: `${item.title} · ${chapter.title}`,
        href: `${href}/chapters/${chapter.id}` });
    }
  }
  const [info, usage] = await Promise.all([artworkDetails(entries.map((entry) => entry.id), true), database(true).rpc("artwork_usage")]);
  const usedBytes = usage.data == null ? undefined : Number(usage.data);
  const editSeries = (slug: string) => {
    const item = series.find((entry) => entry.slug === slug);
    return item && `/admin/series/${item.id}`;
  };
  const bundled: Entry[] = [
    { id: rajanBackdrop, kind: "hero", name: "Rajan: The Thor Curse bundled backdrop", href: editSeries("rajan-the-thor-curse") },
    { id: drownedCityChapter.cover_id!, kind: "cover", name: "The Drowned City bundled cover", href: editSeries("the-drowned-city") },
    { id: siteBanner, kind: "hero", name: "Manga World default banner" },
  ];
  const rows = [...entries, ...bundled].map((entry) => {
    const size = info.get(entry.id) ?? bundledArtwork[entry.id];
    return { ...entry, size, needsSource: !size || undersized(entry.kind, size.width, size.height) };
  }).sort((a, b) => Number(b.needsSource) - Number(a.needsSource));
  return <main id="main" className="site-width admin-content">
    <Link href="/admin" className="back-link">Manage library</Link>
    <h1>Re-process images</h1>
    <p className="muted">Choose a cover or banner to regenerate from its saved source, adjust its focal point, or upload a larger image.</p>
    {usedBytes !== undefined && <p className={usedBytes >= 800_000_000 ? "artwork-warning" : "muted"}>
      Project storage at last check · {(usedBytes / 1_000_000).toFixed(1)} MB. Cover uploads stop at 900 MB.
    </p>}
    <ul className="admin-panel artwork-audit">
      {rows.map((entry) => <li key={`${entry.id}:${entry.href}:${entry.kind}`}>
        <div><strong>{entry.name}</strong><small>{entry.size ? `${entry.size.width} × ${entry.size.height} px` : "Legacy cover · full rendition capped at 1000 × 1500 px"}
          {entry.needsSource ? ` · Higher-resolution source recommended (${artworkSpecs[entry.kind].width} × ${artworkSpecs[entry.kind].height} px)` : " · Meets recommended size"}</small></div>
        {entry.href && <Link href={entry.href} className="button secondary">Edit artwork</Link>}
      </li>)}
    </ul>
  </main>;
}
