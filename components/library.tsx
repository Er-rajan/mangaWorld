"use client";

import { BookOpen, ChevronRight, History, Layers3, LibraryBig } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Art } from "./art";
import { artUrl, chapterArt, chapterLink, isNew, numberLabel, seriesLink, shortDate } from "@/lib/format";
import { useLocal } from "@/lib/local";
import type { ChapterSummary, Series } from "@/lib/types";
import { authorName, siteBanner, siteName } from "@/lib/brand";

export function SeriesStatus({ series }: { series: Series }) {
  return <span className={`status ${series.status}`}><span />{
    !series.chapters.length ? "Coming soon" : series.status === "completed" ? "Completed" : "Ongoing"
  }</span>;
}

export function SeriesCard({ series }: { series: Series }) {
  const count = series.chapters.length;
  return <Link href={seriesLink(series)} className="series-card">
    <div className={`card-art${series.cover_id ? "" : " card-without-cover"}`}>
      {series.cover_id ? <Art id={series.cover_id} /> : <BookOpen className="card-illustration" size={98} strokeWidth={.85} aria-hidden="true" />}
      <SeriesStatus series={series} />
      <div className="card-title"><h3>{series.title}</h3>{series.tags.length > 0 && <p>{series.tags.slice(0, 3).join(" · ")}</p>}</div>
    </div>
    <div className="card-meta"><BookOpen size={15} /> {count ? `${count} ${count === 1 ? "chapter" : "chapters"}` : "Series details"}<ChevronRight size={16} /></div>
  </Link>;
}

export function ChapterRow({ series, chapter, libraryRow = false, recent = false }: {
  series: Series; chapter: ChapterSummary; libraryRow?: boolean; recent?: boolean;
}) {
  return <Link prefetch={false} className="chapter-row" href={chapterLink(series, chapter)}>
    <Art id={chapterArt(series, chapter)} />
    <div className="chapter-row-text">
      <div className="chapter-kicker">{libraryRow ? series.title : `Chapter ${numberLabel(chapter.number)}`}</div>
      <h3>{chapter.title}</h3>
      <p>{libraryRow ? `Chapter ${numberLabel(chapter.number)} · ` : ""}{shortDate(chapter.release_at)}</p>
    </div>
    {recent && <span className="new-badge">New</span>}
    <ChevronRight className="row-chevron" size={16} />
  </Link>;
}

export function ContinueReading({ series }: { series: Series[] }) {
  const progress = useLocal("progress");
  const readable = new Set(series.flatMap((item) => item.chapters.map((chapter) => chapterLink(item, chapter))));
  const entry = Object.values(progress).filter((item) => readable.has(item.path)).sort((a, b) => b.updated - a.updated)[0];
  if (!entry) return null;
  return <a className="resume-strip" href={`${entry.path}?page=${entry.page}`}>
    <span className="section-icon"><History size={21} /></span>
    <span><strong>Continue reading</strong><small>{entry.series} · {entry.chapter} · Page {entry.page} of {entry.total}</small></span>
    <ChevronRight size={19} />
  </a>;
}

export function BrowseLibrary({ series, today }: { series: Series[]; today: number }) {
  const [tag, setTag] = useState("");
  const tags = [...new Map(series.flatMap((item) => item.tags.map((name) => [name.toLowerCase(), name] as const))).values()].sort();
  const selected = tag ? series.filter((item) => item.tags.some((value) => value.toLowerCase() === tag.toLowerCase())) : series;
  const latest = series.flatMap((item) => item.chapters.map((chapter) => ({ series: item, chapter })))
    .sort((a, b) => Date.parse(b.chapter.release_at) - Date.parse(a.chapter.release_at)).slice(0, 3);

  return <div className="library-columns">
    <section id="series" aria-labelledby="series-title">
      <div className="section-heading"><span className="section-icon"><LibraryBig size={21} /></span>
        <h2 id="series-title">Browse series</h2>
      </div>
      {tags.length > 0 && <div className="filters" aria-label="Filter by genre">
        <button aria-pressed={!tag} onClick={() => setTag("")}>All series</button>
        {tags.map((value) => <button key={value} aria-pressed={tag === value} onClick={() => setTag(value)}>{value}</button>)}
      </div>}
      {selected.length ? <div className="series-grid">
        {selected.map((entry) => <SeriesCard key={entry.id} series={entry} />)}
      </div> : <p className="empty-box">The first series is on its way.</p>}
    </section>
    <aside aria-labelledby="latest-title">
      <div className="section-heading"><span className="section-icon"><Layers3 size={21} /></span>
        <h2 id="latest-title">Latest chapters</h2>
      </div>
      {latest.length ? <div className="latest-list">
        {latest.map(({ series: entry, chapter }) => <ChapterRow key={`${entry.id}/${chapter.id}`} series={entry}
          chapter={chapter} libraryRow recent={isNew(chapter.release_at, today)} />)}
      </div> : <div className="release-empty">
        <BookOpen size={25} aria-hidden="true" />
        <p>New chapters will appear here.</p>
      </div>}
    </aside>
  </div>;
}

export function Hero({ series }: { series?: Series }) {
  const first = series?.chapters[0];
  const customArtwork = series?.hero ?? (series?.cover_id ? artUrl(series.cover_id, "full") : undefined);
  return <section className={`hero${customArtwork ? "" : " hero-world"}`} aria-labelledby="hero-title">
    <img className={`hero-art${series?.cover_id && !series.hero ? " cover-hero" : ""}`} src={customArtwork ?? siteBanner} alt="" fetchPriority="high" />
    <div className="hero-content">
      <div className="hero-eyebrow"><span className="hero-dot" />{series ? "Featured manga" : "Independent manga library"}</div>
      <h1 id="hero-title">{series?.title ?? siteName}</h1>
      <p className="hero-author">By <Link href="/about">{authorName}</Link></p>
      <p>{series?.description || (series && !first ? "Chapters coming soon." : "Original manga, published one chapter at a time.")}</p>
      {series && <div className="hero-actions">
        {first && <a href={chapterLink(series, first)} className="button primary"><BookOpen size={18} /> Start reading</a>}
        <Link href={seriesLink(series)} className={`button ${first ? "hero-secondary" : "primary"}`}>Series details <ChevronRight size={17} /></Link>
      </div>}
    </div>
    {series?.tags.length ? <div className="hero-tags">{series.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
  </section>;
}
