"use client";

import { Copy, Eye, Heart, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLocal, setLocal, useLocal, visitorId } from "@/lib/local";

type Stats = { views: number; likes: number; liked?: boolean };

export function ReaderSocial({ id, path, title, initial, reactionsAvailable }: {
  id: string; path: string; title: string; initial: Stats; reactionsAvailable: boolean;
}) {
  const [stats, setStats] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const likes = useLocal("likes");
  const liked = likes.includes(path);
  const dialog = useRef<HTMLDialogElement>(null);
  const changedReaction = useRef(false);

  useEffect(() => {
    if (!reactionsAvailable) return;
    const visitor = visitorId();
    if (!visitor) return;
    fetch("/api/reaction", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visitor, action: "view", liked: false }) })
      .then((response) => response.ok ? response.json() as Promise<Stats> : null)
      .then((data) => {
        if (data) setStats((current) => changedReaction.current ? { ...current, views: Math.max(current.views, data.views) } : data);
      }).catch(() => {});
  }, [id, reactionsAvailable]);

  const active = stats.liked ?? liked;

  async function toggleLike() {
    if (!reactionsAvailable) {
      const saved = getLocal("likes").filter((entry) => entry !== path);
      setLocal("likes", active ? saved : [...saved, path]);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const choice = !active;
      const response = await fetch("/api/reaction", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visitor: visitorId(), action: "like", liked: choice }) });
      if (!response.ok) throw new Error();
      const data: Stats = await response.json();
      changedReaction.current = true;
      setStats((current) => ({ ...data, views: Math.max(current.views, data.views) }));
      const saved = getLocal("likes").filter((entry) => entry !== path);
      setLocal("likes", choice ? [...saved, path] : saved);
    } catch { setMessage("Couldn’t save the reaction. Try again online."); }
    finally { setBusy(false); }
  }

  const shareLink = encodeURIComponent(shareUrl);
  return <>
    <div className="reader-social" aria-label="Chapter reactions and sharing">
      {reactionsAvailable && <span><Eye size={18} /> {stats.views} {stats.views === 1 ? "view" : "views"}</span>}
      <button className="button secondary reaction-button" aria-pressed={active} disabled={busy} onClick={toggleLike}>
        <Heart size={18} fill={active ? "currentColor" : "none"} />
        {reactionsAvailable ? `${stats.likes} ${stats.likes === 1 ? "like" : "likes"}` : "Like chapter"}
      </button>
      <button className="button secondary" onClick={() => {
        setShareUrl(new URL(path, window.location.origin).href);
        setMessage("");
        dialog.current?.showModal();
      }}><Share2 size={18} /> Share</button>
      <span aria-live="polite" className="social-message">{message}</span>
    </div>
    <dialog ref={dialog} className="small-dialog" aria-label="Share chapter">
      <div className="split-heading"><h2>Share chapter</h2>
        <button className="icon-button" aria-label="Close sharing" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <div className="share-actions">
        <button className="button primary" onClick={async () => {
          try { await navigator.clipboard.writeText(shareUrl); setMessage("Link copied."); }
          catch { setMessage("Select and copy the link below."); }
        }}><Copy size={17} /> Copy link</button>
        <a className="button secondary" href={`https://wa.me/?text=${encodeURIComponent(title)}%20${shareLink}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="button secondary" href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${shareLink}`} target="_blank" rel="noreferrer">X</a>
      </div>
      <input value={shareUrl} readOnly aria-label="Chapter link" onFocus={(event) => event.target.select()} />
      <p aria-live="polite">{message}</p>
    </dialog>
  </>;
}
