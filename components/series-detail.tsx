"use client";

import { ArrowDownWideNarrow, Bell, BookOpen, Check, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { ResponsiveArt } from "./responsive-art";
import { heroSizes } from "@/lib/artwork";
import { ChapterRow, ContinueReading, SeriesStatus } from "./library";
import { CharacterProfiles } from "./character-profiles";
import { chapterLink, fullDate, isNew } from "@/lib/format";
import { getLocal, setLocal, useLocal } from "@/lib/local";
import { drownedCitySlug, upcomingDrownedCityChapter } from "@/lib/drowned-city";
import type { Character, ScheduledRelease, Series } from "@/lib/types";

function ReleaseCountdown({ release, today }: { release: ScheduledRelease; today: number }) {
  const [now, setNow] = useState(today);
  const hours = Math.max(0, Math.ceil((Date.parse(release.release_at) - now) / 3_600_000));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="chapter-row upcoming-row">
    <span className="upcoming-thumbnail"><Clock3 size={21} aria-hidden="true" /></span>
    <div className="chapter-row-text"><h3>Chapter {release.number}</h3>
      <p>Scheduled for <time dateTime={release.release_at}>{fullDate(release.release_at)}</time></p></div>
    <span className="upcoming-label">{hours >= 24 ? `In ${Math.ceil(hours / 24)} days` : hours ? `In ${hours}h` : "Due now"}</span>
  </div>;
}

export function SeriesDetail({ series, today, profiles, scheduled }: {
  series: Series; today: number; profiles: Character[]; scheduled?: ScheduledRelease;
}) {
  const [newest, setNewest] = useState(true);
  const follows = useLocal("follows");
  const following = follows.includes(series.slug);
  const first = series.chapters[0];
  const byDate = [...series.chapters].sort((a, b) => Date.parse(a.release_at) - Date.parse(b.release_at) || a.number - b.number);
  const latest = byDate.at(-1);
  const chapters = newest ? byDate.reverse() : byDate;
  const upcoming = upcomingDrownedCityChapter(series);
  const cover = series.cover_id ?? series.chapters[0]?.first_page;
  const banner = series.hero_id ?? series.hero;
  const showCover = !banner || Boolean(cover);
  return <main id="main" className="site-width detail-page">
    <section className={`detail-hero${series.slug === drownedCitySlug ? " drowned-city-hero" : ""}${banner ? " detail-hero-with-art" : ""}${showCover ? "" : " detail-hero-no-cover"}`}>
      {banner && <ResponsiveArt asset={banner} artwork={series.heroArtwork} alt="" sizes={heroSizes} className="detail-backdrop" priority purpose="hero" />}
      {showCover && <ResponsiveArt asset={cover ?? "/placeholder.webp"} artwork={series.coverArtwork} alt={cover ? `${series.title} cover` : ""}
        sizes="(max-width: 580px) 144px, 245px" eager className="detail-cover" />}
      <div className="detail-copy">
        <div className="detail-status"><SeriesStatus series={series} />
          <span>{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}</span></div>
        <h1>{series.title}</h1>
        {series.tags.length > 0 && <div className="detail-tags">{series.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
        {series.description && <p>{series.description}</p>}
        <div className="detail-actions">
          {first && <a href={chapterLink(series, first)} className="button primary"><BookOpen size={18} /> Start reading</a>}
          {latest && <a href={chapterLink(series, latest)} className="button secondary"><Clock3 size={18} /> Latest chapter</a>}
          <button className="button secondary" aria-pressed={following} onClick={() => {
            const entries = getLocal("follows");
            setLocal("follows", entries.includes(series.slug) ? entries.filter((item) => item !== series.slug) : [...entries, series.slug]);
          }}>{following ? <Check size={18} /> : <Bell size={18} />}{following ? "Following" : "Follow"}</button>
        </div>
      </div>
    </section>
    <ContinueReading series={[series]} />
    <section className="detail-chapters" aria-labelledby="chapters-title">
      <div className="split-heading"><h2 id="chapters-title">Chapters <span>({chapters.length})</span></h2>
        {chapters.length > 1 && <button className="button secondary" aria-label="Toggle chapter sort order" onClick={() => setNewest(!newest)}>
          <ArrowDownWideNarrow size={17} />{newest ? "Newest first" : "Oldest first"}
        </button>}
      </div>
      {chapters.length || scheduled ? <div className="latest-list">
        {chapters.map((chapter) => <ChapterRow key={chapter.id} series={series} chapter={chapter} today={today} recent={isNew(chapter.release_at, today)} />)}
        {scheduled && <ReleaseCountdown release={scheduled} today={today} />}
        {!scheduled && upcoming !== undefined && <div className="chapter-row upcoming-row">
          <span className="upcoming-thumbnail"><Clock3 size={21} aria-hidden="true" /></span>
          <div className="chapter-row-text"><h3>Chapter {upcoming}</h3></div>
          <span className="upcoming-label">Coming soon</span>
        </div>}
      </div> : <p className="empty-box">Chapters coming soon.</p>}
    </section>
    {profiles.length > 0 && <section className="detail-chapters" aria-labelledby="characters-title">
      <div className="section-heading"><h2 id="characters-title">Characters</h2></div>
      <CharacterProfiles profiles={profiles} />
    </section>}
  </main>;
}
