"use client";

import { Film, Heart, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLocal, setLocal, useLocal, visitorId } from "@/lib/local";
import type { Reel, ReelCategory } from "@/lib/reels";
import { ReelPlayer } from "./reel-player";

function ReelActions({ clip }: { clip: Reel }) {
  const [count, setCount] = useState(clip.likes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyLink, setCopyLink] = useState("");
  const sharePath = `/reels?clip=${clip.id}`;
  const liked = useLocal("likes").includes(sharePath);

  async function like() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/reels/like", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clip.id, visitor: visitorId(), liked: !liked }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { count: number; liked: boolean };
      setCount(result.count);
      const saved = getLocal("likes").filter((item) => item !== sharePath);
      setLocal("likes", result.liked ? [...saved, sharePath] : saved);
    } catch { setMessage("Couldn’t save the like. Try again in a moment."); }
    finally { setBusy(false); }
  }

  async function share() {
    const url = new URL(sharePath, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: clip.title, url });
      else { await navigator.clipboard.writeText(url); setMessage("Link copied."); }
    } catch (error) {
      if ((error as Error).name !== "AbortError") setCopyLink(url);
    }
  }

  return <>
    <div className="reel-actions">
      {clip.chapter_path && <a className="button primary" href={clip.chapter_path}>{clip.chapter_path.startsWith("/read/") ? "Read this chapter" : "Read this series"}</a>}
      <button type="button" className="button secondary reaction-button" aria-label={`Like clip, ${count} ${count === 1 ? "like" : "likes"}`} aria-pressed={liked} disabled={busy} onClick={like}>
        <Heart size={17} fill={liked ? "currentColor" : "none"} aria-hidden="true" /> {count}</button>
      <button type="button" className="button secondary" onClick={share}><Share2 size={17} aria-hidden="true" /> Share</button>
    </div>
    {copyLink && <input readOnly aria-label="Reel link" value={copyLink} onFocus={(event) => event.currentTarget.select()} />}
    {message && <p role="status">{message}</p>}
  </>;
}

export function ReelFeed({ clips, categories, initial, available }: {
  clips: Reel[]; categories: ReelCategory[]; initial?: string; available: boolean;
}) {
  const [category, setCategory] = useState("");
  const [active, setActive] = useState("");
  const [foreground, setForeground] = useState(true);
  const [feedVisible, setFeedVisible] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const initialClip = initial && clips.some((item) => item.id === initial) ? initial : undefined;
  const visible = category ? clips.filter((clip) => clip.category_id === category) : clips;
  const activeIndex = visible.findIndex((clip) => clip.id === active);

  useEffect(() => {
    const sync = () => setForeground(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const selected = !category && initialClip ? document.getElementById(`reel-${initialClip}`) : null;
    element.scrollTop = selected ? selected.offsetTop : 0;
    if (!("IntersectionObserver" in window)) {
      setFeedVisible(true);
      setActive((element.firstElementChild as HTMLElement | null)?.dataset.clip ?? "");
      return;
    }
    const viewport = new IntersectionObserver(([entry]) => setFeedVisible(entry.isIntersecting && entry.intersectionRatio >= 0.55),
      { threshold: 0.55 });
    viewport.observe(element);
    const observer = new IntersectionObserver((entries) => {
      const current = entries.find((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55);
      if (current) setActive((current.target as HTMLElement).dataset.clip ?? "");
      else setActive((id) => entries.some((entry) => (entry.target as HTMLElement).dataset.clip === id && entry.intersectionRatio < 0.55) ? "" : id);
    }, { root: element, threshold: 0.55 });
    element.querySelectorAll("[data-clip]").forEach((item) => observer.observe(item));
    return () => { observer.disconnect(); viewport.disconnect(); };
  }, [category, clips.length, initialClip]);

  function move(step: number) {
    const target = visible[activeIndex + step];
    const item = target && document.getElementById(`reel-${target.id}`);
    if (item) rail.current?.scrollTo({ top: item.offsetTop,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <>
    <div className="reel-header">
      <h1>Reels</h1>
      {categories.length > 0 && <nav className="reel-filters filters" aria-label="Reel categories">
        {[{ id: "", name: "All clips" }, ...categories].map((item) => <button type="button" key={item.id} aria-pressed={category === item.id}
          onClick={() => { if (category !== item.id) { setActive(""); setCategory(item.id); } }}>{item.name}</button>)}
      </nav>}
    </div>
    {visible.length ? <>
      <div className="reel-feed" ref={rail} tabIndex={0} aria-label="Reels feed" onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) return;
        event.preventDefault();
        move(event.key.endsWith("Up") ? -1 : 1);
      }}>
        {visible.map((clip) => <article className="reel-slide" key={clip.id} id={`reel-${clip.id}`} data-clip={clip.id}>
          {foreground && feedVisible && clip.id === active ? <ReelPlayer id={clip.youtube_id} title={clip.title} />
            : <div className="reel-video reel-placeholder" aria-hidden="true"><Film size={34} /></div>}
          <div className="reel-caption"><p className="reel-category">{categories.find((item) => item.id === clip.category_id)?.name}</p>
            <h2>{clip.title}</h2>
            {clip.caption && <p>{clip.caption}</p>}
            {clip.tags.length > 0 && <p className="reel-tags">{clip.tags.map((tag) => `#${tag}`).join(" · ")}</p>}
            <ReelActions clip={clip} />
          </div>
        </article>)}
      </div>
      <div className="reel-navigation"><button type="button" className="button secondary" disabled={activeIndex <= 0} onClick={() => move(-1)}>Previous clip</button>
        <button type="button" className="button secondary" disabled={activeIndex < 0 || activeIndex >= visible.length - 1} onClick={() => move(1)}>Next clip</button></div>
    </> : <div className="empty-box reel-empty"><Film size={26} aria-hidden="true" /><h2>No clips yet</h2>
      <p>{available && category ? "Clips in this category will appear here." : "Manga clips will appear here when they’re available."}</p></div>}
  </>;
}
