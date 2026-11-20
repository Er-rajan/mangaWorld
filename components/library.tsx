"use client";

import { BookOpen, ChevronRight, History, Instagram, Layers3, LibraryBig } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Art } from "./art";
import { artUrl, chapterArt, chapterLink, fullDate, isNew, latestReleasedChapter, numberLabel, releaseAge, seriesLink } from "@/lib/format";
import { useLocal } from "@/lib/local";
import type { ChapterSummary, Series } from "@/lib/types";
import { authorName, instagramHandle, instagramUrl, siteBanner, siteName } from "@/lib/brand";

const coverAccents = new Map<string, Promise<string | null>>();

function sampleCover(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 12;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, 12, 12);
  const { data } = context.getImageData(0, 0, 12, 12);
  const weights = Array<number>(24).fill(0);
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    const red = data[pixel], green = data[pixel + 1], blue = data[pixel + 2];
    const high = Math.max(red, green, blue);
    const chroma = high - Math.min(red, green, blue);
    if (chroma < 14 || high < 38 || data[pixel + 3] < 128) continue;
    const angle = high === red ? (green - blue) / chroma
      : high === green ? 2 + (blue - red) / chroma : 4 + (red - green) / chroma;
    weights[Math.round(angle * 4 + 24) % 24] += chroma;
  }
  const strongest = Math.max(...weights);
  return strongest ? `hsl(${weights.indexOf(strongest) * 15} 71% 76%)` : "#d7d3de";
}

async function findCoverAccent(image: HTMLImageElement) {
  try { return sampleCover(image); }
  catch {
    // Public art can redirect to storage. Keep the displayed image independent of the color sample.
    const sample = new Image();
    sample.crossOrigin = "anonymous";
    sample.fetchPriority = "low";
    sample.src = image.currentSrc;
    try { await sample.decode(); return sampleCover(sample); }
    catch { return null; }
  }
}

function applyCoverAccent(image: HTMLImageElement | null) {
  if (!image?.naturalWidth) return;
  const scope = image.closest<HTMLElement>("[data-cover-accent]");
  if (!scope) return;
  const source = image.currentSrc;
  let color = coverAccents.get(source);
  if (!color) {
    color = findCoverAccent(image);
    coverAccents.set(source, color);
  }
  void color.then((accent) => {
    if (!image.isConnected || image.currentSrc !== source) return;
    if (accent) scope.style.setProperty("--cover-accent", accent);
    else scope.style.removeProperty("--cover-accent");
  });
}

function poster(series: Series) {
  if (series.cover_id) return artUrl(series.cover_id);
  const thumbnail = series.chapters[0]?.thumbnail_id;
  return series.hero ?? (thumbnail ? artUrl(thumbnail) : undefined);
}

function useCarousel(count: number, filter = "") {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ back: false, next: false });
  useEffect(() => {
    const element = track.current;
    if (!element) { setEdges({ back: false, next: false }); return; }
    function update() {
      if (!element) return;
      const back = element.scrollLeft > 2;
      const next = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setEdges((previous) => previous.back === back && previous.next === next ? previous : { back, next });
    }
    element.scrollLeft = 0;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [count, filter]);
  return { track, ...edges, move: (direction: number) => {
    const element = track.current;
    if (!element) return;
    const step = element.firstElementChild?.getBoundingClientRect().width ?? element.clientWidth;
    element.scrollBy({ left: direction * (step + 14), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  } };
}

function CarouselButtons({ carousel, controls, label }: { carousel: ReturnType<typeof useCarousel>; controls: string; label: string }) {
  if (!carousel.back && !carousel.next) return null;
  return <div className="carousel-buttons">
    <button className="button secondary" aria-controls={controls} aria-label={`Previous ${label}`} disabled={!carousel.back}
      onClick={() => carousel.move(-1)}>Back</button>
    <button className="button secondary" aria-controls={controls} aria-label={`Next ${label}`} disabled={!carousel.next}
      onClick={() => carousel.move(1)}>Next</button>
  </div>;
}

export function SeriesStatus({ series }: { series: Series }) {
  return <span className={`status ${series.status}`}><span />{
    !series.chapters.length ? "Coming soon" : series.status === "completed" ? "Completed" : "Ongoing"
  }</span>;
}

export function SeriesCard({ series }: { series: Series }) {
  const count = series.chapters.length;
  const latest = latestReleasedChapter(series.chapters);
  const artwork = poster(series);
  return <Link href={seriesLink(series)} className="series-card" data-cover-accent>
    <div className={`card-art${artwork ? "" : " card-without-cover"}`}>
      {artwork ? <img src={artwork} alt="" loading="lazy" decoding="async" ref={applyCoverAccent}
        onLoad={(event) => applyCoverAccent(event.currentTarget)} />
        : <BookOpen className="card-illustration" size={98} strokeWidth={.85} aria-hidden="true" />}
      <SeriesStatus series={series} />
      <div className="card-title"><h3>{series.title}</h3></div>
    </div>
    <div className="card-summary">
      {series.tags.length > 0 && <p className="card-genres">{series.tags.slice(0, 3).join(" · ")}</p>}
      {series.description && <p className="card-synopsis" title={series.description}>{series.description}</p>}
      <div className="card-meta"><BookOpen size={15} /> {count ? `${count} ${count === 1 ? "chapter" : "chapters"}` : "Series details"}<ChevronRight size={16} /></div>
      {latest && <p className="card-latest" title={latest.title}>Latest · Chapter {numberLabel(latest.number)} · {latest.title}</p>}
    </div>
  </Link>;
}

export function ChapterRow({ series, chapter, today, libraryRow = false, recent = false }: {
  series: Series; chapter: ChapterSummary; today: number; libraryRow?: boolean; recent?: boolean;
}) {
  return <Link prefetch={false} className="chapter-row" href={chapterLink(series, chapter)}>
    <Art id={chapter.thumbnail_id ?? chapterArt(series, chapter)} />
    <div className="chapter-row-text">
      <div className="chapter-kicker">{libraryRow ? series.title : `Chapter ${numberLabel(chapter.number)}`}</div>
      <h3>{chapter.title}</h3>
      <p>{libraryRow ? `Chapter ${numberLabel(chapter.number)} · ` : ""}
        <time dateTime={chapter.release_at} title={fullDate(chapter.release_at)}>{releaseAge(chapter.release_at, today)}</time></p>
    </div>
    {recent && <span className="new-badge">New</span>}
    <ChevronRight className="row-chevron" size={16} />
  </Link>;
}

export function ContinueReading({ series }: { series: Series[] }) {
  const progress = useLocal("progress");
  const readable = new Map(series.flatMap((item) => item.chapters.map((chapter) => [chapterLink(item, chapter), { item, chapter }] as const)));
  const entry = Object.values(progress).filter((item) => readable.has(item.path) && Number.isInteger(item.page)
    && item.page > 0 && item.page <= item.total).sort((a, b) => b.updated - a.updated)[0];
  if (!entry) return null;
  const { item, chapter } = readable.get(entry.path)!;
  return <a className="resume-strip" href={`${entry.path}?page=${entry.page}`}>
    <span className="section-icon"><History size={21} /></span>
    <span><strong>Continue reading</strong><small>{item.title} · {chapter.title} · Page {entry.page} of {entry.total}</small></span>
    <ChevronRight size={19} />
  </a>;
}

export function BrowseLibrary({ series, today }: { series: Series[]; today: number }) {
  const [tag, setTag] = useState("");
  const tags = [...new Map(series.flatMap((item) => item.tags.map((name) => [name.toLowerCase(), name] as const))).values()].sort();
  const selected = tag ? series.filter((item) => item.tags.some((value) => value.toLowerCase() === tag.toLowerCase())) : series;
  const latest = series.flatMap((item) => item.chapters.map((chapter) => ({ series: item, chapter })))
    .sort((a, b) => Date.parse(b.chapter.release_at) - Date.parse(a.chapter.release_at)).slice(0, 3);
  const seriesCarousel = useCarousel(selected.length, tag);
  const chapterCarousel = useCarousel(latest.length);

  return <div className="library-columns">
    <section id="series" aria-labelledby="series-title">
      <div className="section-heading"><span className="section-icon"><LibraryBig size={21} /></span>
        <h2 id="series-title">Browse series</h2>
        <CarouselButtons carousel={seriesCarousel} controls="series-carousel" label="series" />
      </div>
      {tags.length > 0 && <div className="filters" aria-label="Filter by genre">
        <button aria-pressed={!tag} onClick={() => setTag("")}>All series</button>
        {tags.map((value) => <button key={value} aria-pressed={tag === value} onClick={() => setTag(value)}>{value}</button>)}
      </div>}
      {selected.length ? <div className="series-carousel carousel-track" id="series-carousel" ref={seriesCarousel.track}>
        {selected.map((entry) => <SeriesCard key={entry.id} series={entry} />)}
      </div> : <p className="empty-box">The first series is on its way.</p>}
    </section>
    <aside className="library-sidebar" aria-labelledby="latest-title">
      <div className="section-heading"><span className="section-icon"><Layers3 size={21} /></span>
        <h2 id="latest-title">Latest chapters</h2>
        <CarouselButtons carousel={chapterCarousel} controls="chapter-carousel" label="chapters" />
      </div>
      {latest.length ? <div className="latest-list chapter-carousel carousel-track" id="chapter-carousel" ref={chapterCarousel.track}>
        {latest.map(({ series: entry, chapter }) => <ChapterRow key={`${entry.id}/${chapter.id}`} series={entry}
          chapter={chapter} today={today} libraryRow recent={isNew(chapter.release_at, today)} />)}
      </div> : <div className="release-empty">
        <BookOpen size={25} aria-hidden="true" />
        <p>New chapters will appear here.</p>
      </div>}
      <div className="author-card">
        <Instagram size={22} aria-hidden="true" />
        <div><h3>Follow {authorName}</h3><p>Artwork and news from the author.</p></div>
        <a href={instagramUrl} target="_blank" rel="noreferrer" className="button secondary">{instagramHandle}</a>
      </div>
    </aside>
  </div>;
}

export function Hero({ series }: { series?: Series }) {
  const first = series?.chapters[0];
  const customArtwork = series?.hero ?? (series?.cover_id ? artUrl(series.cover_id, "full") : undefined);
  const heroStyle = series?.hero ? "hero hero-series-art" : customArtwork ? "hero" : "hero hero-world";
  const haze = series ? poster(series) : undefined;
  return <section className={heroStyle} aria-labelledby="hero-title" data-cover-accent>
    {haze && <img className="hero-haze" src={haze} alt="" decoding="async" ref={applyCoverAccent}
      onLoad={(event) => applyCoverAccent(event.currentTarget)} />}
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
