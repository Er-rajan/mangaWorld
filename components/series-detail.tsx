"use client";

import { ArrowDownWideNarrow, Bell, BookOpen, Check, Clock3 } from "lucide-react";
import { useState } from "react";
import { Art } from "./art";
import { ChapterRow, ContinueReading, SeriesStatus } from "./library";
import { chapterLink, isNew } from "@/lib/format";
import { getLocal, setLocal, useLocal } from "@/lib/local";
import { drownedCitySlug, upcomingDrownedCityChapter } from "@/lib/drowned-city";
import type { Series } from "@/lib/types";

export function SeriesDetail({ series, today }: { series: Series; today: number }) {
  const [newest, setNewest] = useState(true);
  const follows = useLocal("follows");
  const following = follows.includes(series.slug);
  const first = series.chapters[0];
  const byDate = [...series.chapters].sort((a, b) => Date.parse(a.release_at) - Date.parse(b.release_at) || a.number - b.number);
  const latest = byDate.at(-1);
  const chapters = newest ? byDate.reverse() : byDate;
  const upcoming = upcomingDrownedCityChapter(series);
  return <main id="main" className="site-width detail-page">
    <section className={`detail-hero${series.slug === drownedCitySlug ? " drowned-city-hero" : ""}`}>
      <Art id={series.cover_id} eager full className="detail-cover" />
      <div className="detail-copy">
        <SeriesStatus series={series} />
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
      {chapters.length ? <div className="latest-list">
        {chapters.map((chapter) => <ChapterRow key={chapter.id} series={series} chapter={chapter} recent={isNew(chapter.release_at, today)} />)}
        {upcoming !== undefined && <div className="chapter-row upcoming-row">
          <span className="upcoming-thumbnail"><Clock3 size={21} aria-hidden="true" /></span>
          <div className="chapter-row-text"><h3>Chapter {upcoming}</h3></div>
          <span className="upcoming-label">Coming soon</span>
        </div>}
      </div> : <p className="empty-box">Chapters coming soon.</p>}
    </section>
  </main>;
}
