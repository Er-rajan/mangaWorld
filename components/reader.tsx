"use client";

import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Clock3, Download, Expand, Maximize, Minimize, PanelTop, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { artUrl, numberLabel } from "@/lib/format";
import { getLocal, rememberProgress, setLocal, useLocal, type ReaderPrefs, type SavedPage } from "@/lib/local";
import type { Chapter, Direction, PageArt, ReaderMode } from "@/lib/types";
import { ThemePicker } from "./theme";
import { ReaderSocial, type Comments } from "./reader-social";
import { useOfflineChapter } from "./offline";

type Props = { series: string; seriesUrl: string; path: string; chapter: Chapter; next?: string; prev?: string;
  upcoming?: number; reactionsAvailable: boolean; watermark: string; comments?: Comments };

const backgrounds = { ink: "#0c0b10", gray: "#323039", paper: "#dfd9d2" };

function ChapterNav({ prev, next, seriesUrl, upcoming }: Pick<Props, "prev" | "next" | "seriesUrl" | "upcoming">) {
  return <nav className="chapter-nav" aria-label="Chapter navigation">
    {prev ? <a href={prev} className="button secondary"><ChevronLeft size={17} /> Previous chapter</a>
      : <a href={seriesUrl} className="button secondary"><BookOpen size={17} /> Chapter list</a>}
    {next ? <a href={next} className="button primary">Next chapter <ChevronRight size={17} /></a>
      : upcoming !== undefined && <span className="upcoming-label"><Clock3 size={15} aria-hidden="true" /> Chapter {upcoming} coming soon</span>}
  </nav>;
}

export function Reader({ series, seriesUrl, path, chapter, next, prev, upcoming, reactionsAvailable, watermark, comments }: Props) {
  const total = chapter.pages.length;
  const minimum = chapter.cover_id ? 0 : 1;
  const prefs = useLocal("prefs");
  const bookmarks = useLocal("bookmarks");
  const [desktop, setDesktop] = useState(false);
  const mode = !desktop && prefs.mode === "spread" ? "single" : prefs.mode;
  const rtl = prefs.direction !== "ltr";
  const [page, setPage] = useState(minimum);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const figures = useRef(new Map<number, HTMLElement>());
  const scrollTarget = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(0);
  const toolbar = useRef<HTMLDivElement>(null);
  const previousMode = useRef<ReaderMode>(mode);
  const cover = chapter.cover_id ? artUrl(chapter.cover_id, "full") : null;
  const offline = useOfflineChapter(path, chapter.revision, [...(cover ? [cover] : []),
    ...chapter.pages.map((item) => artUrl(item.asset_id, "full"))]);

  const clamp = useCallback((n: number) => Math.max(minimum, Math.min(total || minimum, Math.floor(n))), [minimum, total]);

  const scrollToPage = useCallback((index: number) => {
    const element = figures.current.get(index);
    if (!element) return;
    scrollTarget.current = index;
    const offset = toolbar.current?.offsetHeight ?? 0;
    window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - offset - 12, behavior: "instant" });
    requestAnimationFrame(() => { scrollTarget.current = null; });
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("page");
    const stored = getLocal("progress")[path]?.page;
    const wanted = query && /^\d+$/.test(query) ? Number(query) : stored ?? minimum;
    const index = clamp(wanted);
    const savedMode = getLocal("prefs").mode;
    setPage(index);
    setReady(true);
    if (savedMode === "vertical" && index > minimum) requestAnimationFrame(() => scrollToPage(index));
  }, [path, minimum, clamp, scrollToPage]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 850px)");
    function update() { setDesktop(media.matches); }
    function syncFullscreen() { setFullscreen(Boolean(document.fullscreenElement)); }
    update();
    setFullscreenAvailable(Boolean(document.fullscreenEnabled));
    media.addEventListener("change", update);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!ready || mode !== "vertical") return;
    function scroll() {
      if (frame.current !== null || scrollTarget.current !== null || dialog.current?.open) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (scrollTarget.current !== null || dialog.current?.open) return;
        const point = (window.innerHeight + (toolbar.current?.offsetHeight ?? 0)) * 0.53;
        let nearest: number | undefined;
        let distance = Infinity;
        for (const [index, element] of figures.current) {
          const box = element.getBoundingClientRect();
          const next = Math.max(box.top - point, point - box.bottom, 0);
          if (next < distance) { distance = next; nearest = index; }
          if (next === 0) break;
        }
        if (nearest !== undefined) setPage(nearest);
      });
    }
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [mode, ready]);

  useEffect(() => {
    const previous = previousMode.current;
    previousMode.current = mode;
    if (!ready || previous === mode) return;
    if (mode === "vertical") scrollToPage(page);
    else if (previous === "vertical") window.scrollTo({ top: 0, behavior: "instant" });
  }, [mode, page, ready, scrollToPage]);

  const saved = useCallback((index: number): SavedPage => ({
    path, series, chapter: chapter.title, page: index, total, updated: Date.now(),
  }), [path, series, chapter.title, total]);

  useEffect(() => {
    if (ready && page >= 1 && total) rememberProgress(saved(page));
  }, [ready, page, total, saved]);

  const setIndex = useCallback((index: number) => {
    const next = clamp(index);
    setPage(next);
    if (mode === "vertical") scrollToPage(next);
    else if ((root.current?.querySelector(".reader-stage")?.getBoundingClientRect().bottom ?? Infinity) < 0) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [clamp, mode, scrollToPage]);

  const spreadStart = page > 0 ? 2 * Math.floor((page - 1) / 2) + 1 : 0;
  const firstVisible = mode === "spread" ? spreadStart : page;
  const lastVisible = mode === "spread" && page > 0 ? Math.min(firstVisible + 1, total) : page;
  const move = useCallback((delta: -1 | 1) => {
    if (mode !== "spread") setIndex(page + delta);
    else if (page === 0) { if (delta === 1) setIndex(1); }
    else setIndex(delta === 1 ? (lastVisible < total ? lastVisible + 1 : page) : firstVisible - 2);
  }, [firstVisible, lastVisible, mode, page, setIndex, total]);

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented
        || document.querySelector("dialog[open]") || (event.target as HTMLElement | null)?.closest("input, select, textarea, [contenteditable]")) return;
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && mode !== "vertical") {
        event.preventDefault();
        move((event.key === "ArrowLeft") === rtl ? 1 : -1);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mode, move, rtl]);

  useEffect(() => {
    if (!ready) return;
    const preload = chapter.pages.slice(lastVisible, lastVisible + 3).map((item) => {
      const image = new Image();
      image.fetchPriority = "low";
      image.src = artUrl(item.asset_id, "full");
      return image;
    });
    return () => { preload.length = 0; };
  }, [chapter.pages, lastVisible, ready]);

  function changePrefs(change: Partial<ReaderPrefs>) {
    setLocal("prefs", { ...getLocal("prefs"), ...change });
  }

  function changeMode(next: ReaderMode, direction?: Direction) {
    changePrefs({ mode: next, direction: direction ?? (next === "vertical" ? "vertical" : prefs.direction === "vertical" ? "rtl" : prefs.direction) });
  }

  function changeDirection(next: Direction) {
    if (next === "vertical") changeMode("vertical", next);
    else if (mode === "vertical") changeMode("single", next);
    else changePrefs({ direction: next });
  }

  function bookmark() {
    const entries = getLocal("bookmarks");
    const entry = saved(page);
    const remaining = entries.filter((item) => item.path !== path || item.page !== page);
    setLocal("bookmarks", entries.length === remaining.length ? [entry, ...entries].slice(0, 150) : remaining);
  }

  function openSettings() {
    const position = window.scrollY;
    dialog.current?.showModal();
    if (position !== window.scrollY) window.scrollTo({ top: position, behavior: "instant" });
  }

  const bookmarked = bookmarks.some((entry) => entry.path === path && entry.page === page);
  const counter = page === 0 ? `Cover · ${total} pages` : total
    ? `${firstVisible === lastVisible ? page : `${firstVisible}–${lastVisible}`} / ${total}` : "0 / 0";
  const progress = total ? lastVisible / total : 0;
  const scale = (zoomed ? Math.max(150, prefs.zoom) : prefs.zoom) / 100;

  function drawPage(item: PageArt, index: number, loading: "eager" | "lazy") {
    return <figure key={index} className="manga-page" data-page={index} style={{ "--page-ratio": item.width / item.height } as React.CSSProperties} ref={(element) => {
      if (element) figures.current.set(index, element); else figures.current.delete(index);
    }}>
      <img src={artUrl(item.asset_id, "full")} alt={item.alt || `${series}, chapter ${chapter.number}, page ${index}`}
        width={item.width} height={item.height} loading={loading} decoding="async" draggable={false} />
      {watermark && <span className="watermark" aria-hidden="true">{watermark}</span>}
    </figure>;
  }

  const titleCard = cover && <section className="opening-card" aria-label="Chapter cover" ref={(element) => {
    if (element) figures.current.set(0, element); else figures.current.delete(0);
  }}>
    <img src={cover} alt={`${chapter.title} cover`} />
    {watermark && <span className="watermark" aria-hidden="true">{watermark}</span>}
    <div><span>Chapter {numberLabel(chapter.number)}</span><h2>{chapter.title}</h2>
      <button className="button primary" onClick={() => setIndex(1)}><BookOpen size={18} /> Begin chapter</button></div>
  </section>;
  const visible = mode === "vertical" ? chapter.pages.map((item, index) => drawPage(item, index + 1, index < 1 ? "eager" : "lazy"))
    : page > 0 ? chapter.pages.slice(firstVisible - 1, lastVisible).map((item, i) => drawPage(item, firstVisible + i, "eager")) : [];
  const nav = <ChapterNav prev={prev} next={next} seriesUrl={seriesUrl}
    upcoming={mode === "vertical" || lastVisible >= total ? upcoming : undefined} />;

  return <main className="reader" id="main" ref={root}>
    <div className="reader-toolbar" ref={toolbar}>
      <div className="reader-control-row">
        <div className="reader-identity">
          <a className="icon-button" href={seriesUrl} aria-label="Back to series"><ChevronLeft size={21} /></a>
          <div><a href={seriesUrl}>{series}</a><h1>{chapter.title}</h1></div>
        </div>
        <div className="reader-controls">
          <span className="reader-count" aria-live={mode === "vertical" ? "off" : "polite"}>{counter}</span>
          <button className="icon-button" title="Bookmark this page" aria-pressed={bookmarked} aria-label="Bookmark this page" disabled={!total}
            onClick={bookmark}><Bookmark size={19} fill={bookmarked ? "currentColor" : "none"} /></button>
          <button className="icon-button" title="Reader settings" aria-label="Reader settings" onClick={openSettings}><Settings2 size={20} /></button>
          {fullscreenAvailable && <button className="icon-button fullscreen-button" title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => {
              const action = fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen();
              void action.catch(() => {});
            }}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>}
          <div className="reader-theme"><ThemePicker compact /></div>
        </div>
      </div>
      <progress value={progress} max="1" className="reader-progress" aria-label="Chapter progress" />
    </div>

    <div className="reader-stage" style={{ background: backgrounds[prefs.background] }}>
      <div className={`reader-layout ${mode} ${mode === "spread" && rtl ? "reader-rtl" : ""} ${scale > 1 ? "is-zoomed" : ""}`}
        style={{ "--reader-scale": scale, "--reader-brightness": prefs.brightness / 100 } as React.CSSProperties}
        onTouchStart={(event) => {
          if (mode === "vertical" || scale > 1 || event.touches.length !== 1) return;
          touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }} onTouchEnd={(event) => {
          const start = touch.current;
          const end = event.changedTouches[0];
          touch.current = null;
          if (mode === "vertical" || !start || !end) return;
          const delta = end.clientX - start.x;
          if (Math.abs(delta) > 45 && Math.abs(end.clientY - start.y) < Math.abs(delta) * .65) {
            lastSwipe.current = Date.now();
            move((delta > 0) === rtl ? 1 : -1);
          }
        }}>
        {(mode === "vertical" || page === 0) && titleCard}
        {visible}
        {!total && <p className="empty-box">This chapter has no pages yet.</p>}
        {mode !== "vertical" && page > 0 && total > 0 && <div className="tap-zones">
          <button tabIndex={-1} aria-label={rtl ? "Next page on left" : "Previous page on left"} onClick={() => {
            if (Date.now() - lastSwipe.current > 300) move(rtl ? 1 : -1);
          }} />
          <button tabIndex={-1} aria-label={rtl ? "Previous page on right" : "Next page on right"} onClick={() => {
            if (Date.now() - lastSwipe.current > 300) move(rtl ? -1 : 1);
          }} />
        </div>}
      </div>
      {mode !== "vertical" && <div className="page-nav">
        <button className="button secondary" disabled={firstVisible <= minimum} onClick={() => move(-1)}><ChevronLeft size={18} /> Previous page</button>
        <button className="button secondary" onClick={() => setZoomed(!zoomed)} aria-pressed={zoomed} aria-label="Quick zoom"><Expand size={17} /></button>
        <button className="button primary" disabled={lastVisible >= total} onClick={() => move(1)}>Next page <ChevronRight size={18} /></button>
      </div>}
    </div>

    <div className="reader-end">
      {chapter.note && <aside className="author-note"><h2>Author’s note</h2><p>{chapter.note}</p></aside>}
      {nav}
      <ReaderSocial id={chapter.id} path={path} title={`${series} · ${chapter.title}`} comments={comments} reactionsAvailable={reactionsAvailable}
        initial={{ views: chapter.views, likes: chapter.likes }} />
    </div>

    <dialog className="small-dialog reader-dialog" ref={dialog} aria-label="Reader settings">
      <div className="split-heading"><h2><PanelTop size={21} /> Reader settings</h2>
        <button className="icon-button" aria-label="Close settings" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <div className="reader-setting-grid">
        <label>Reading mode<select value={mode} onChange={(event) => changeMode(event.target.value as ReaderMode)}>
          <option value="vertical">Vertical scroll</option><option value="single">Single page</option><option value="spread" disabled={!desktop}>Double-page spread</option>
        </select></label>
        <label>Reading direction<select value={mode === "vertical" ? "vertical" : rtl ? "rtl" : "ltr"}
          onChange={(event) => changeDirection(event.target.value as Direction)}>
          <option value="vertical">Vertical</option><option value="rtl">Right to left</option><option value="ltr">Left to right</option>
        </select></label>
        <label>Brightness <span>{prefs.brightness}%</span><input type="range" min="35" max="110" value={prefs.brightness}
          onChange={(event) => changePrefs({ brightness: Number(event.target.value) })} /></label>
        <label>Zoom <span>{prefs.zoom}%</span><input type="range" min="75" max="225" step="5" value={prefs.zoom}
          onChange={(event) => { setZoomed(false); changePrefs({ zoom: Number(event.target.value) }); }} /></label>
        <label>Background<select value={prefs.background} onChange={(event) => changePrefs({ background: event.target.value as ReaderPrefs["background"] })}>
          <option value="ink">Ink black</option><option value="gray">Slate gray</option><option value="paper">Warm paper</option>
        </select></label>
        <label>Jump to page<select key={page} defaultValue="" disabled={!total} onChange={(event) => {
          const next = Number(event.target.value);
          dialog.current?.close();
          setIndex(next);
        }}><option value="" disabled>Choose a page</option>{cover && <option value="0">Cover</option>}
          {chapter.pages.map((_, index) => <option key={index} value={index + 1}>Page {index + 1}</option>)}</select></label>
      </div>
      <div className="reader-dialog-theme"><ThemePicker /></div>
      {offline.state !== "unavailable" && <div className="offline-status" aria-live="polite">
        <Download size={17} /> {offline.state === "saved" ? "Available offline" : offline.state === "saving" ? "Saving for offline reading…" : "Offline copy could not be saved"}
        {offline.state === "failed" && <button className="button secondary" onClick={offline.retry}>Retry</button>}
      </div>}
      {nav}
    </dialog>
  </main>;
}
