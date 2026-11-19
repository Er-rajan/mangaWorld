"use client";

import { Bookmark, Heart, History, Trash2 } from "lucide-react";
import { SeriesCard } from "./library";
import { chapterLink } from "@/lib/format";
import { getLocal, setLocal, useLocal, type SavedPage } from "@/lib/local";
import type { Series } from "@/lib/types";

export function Shelf({ series }: { series: Series[] }) {
  const follows = useLocal("follows");
  const bookmarks = useLocal("bookmarks");
  const progress = useLocal("progress");
  const readable = new Set(series.flatMap((item) => item.chapters.map((chapter) => chapterLink(item, chapter))));
  const list = series.filter((entry) => follows.includes(entry.slug));
  const history = Object.values(progress).filter((entry) => readable.has(entry.path)).sort((a, b) => b.updated - a.updated);
  function saved(entry: SavedPage, canDelete: boolean) {
    return <li key={`${entry.path}/${entry.page}`} className="saved-row">
      <a href={`${entry.path}?page=${entry.page}`}><strong>{entry.chapter}</strong><small>{entry.series} · Page {entry.page} of {entry.total}</small></a>
      {canDelete && <button className="icon-button" aria-label={`Remove bookmark for ${entry.chapter}, page ${entry.page}`}
        onClick={() => setLocal("bookmarks", getLocal("bookmarks").filter((item) => item.path !== entry.path || item.page !== entry.page))}><Trash2 size={17} /></button>}
    </li>;
  }
  return <main id="main" className="site-width detail-page shelf-page">
    <h1>My shelf</h1><p>Bookmarks, followed series, and progress saved on this device.</p>
    <div className="shelf-columns">
      <section>
        <h2><History size={21} /> Reading history</h2>
        {history.length ? <ul className="saved-list">{history.map((entry) => saved(entry, false))}</ul>
          : <p className="empty-box">Your reading history will appear here.</p>}
      </section>
      <section>
        <h2><Bookmark size={21} /> Bookmarks</h2>
        {bookmarks.length ? <ul className="saved-list">{bookmarks.map((entry) => saved(entry, true))}</ul>
          : <p className="empty-box">Bookmark a page in the reader to find it here.</p>}
      </section>
    </div>
    <section><h2><Heart size={21} /> Following</h2>
      {list.length ? <div className="series-grid">{list.map((entry) => <SeriesCard key={entry.slug} series={entry} />)}</div>
        : <p className="empty-box">Follow a series to keep it on your shelf.</p>}</section>
  </main>;
}
