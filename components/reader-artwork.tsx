"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { artUrl, readerThumbnail } from "@/lib/format";
import type { PageArt } from "@/lib/types";

export function ReaderArtwork({ item, alt, eager }: { item: PageArt; alt: string; eager: boolean }) {
  const image = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [previewing, setPreviewing] = useState(true);
  const full = artUrl(item.asset_id, "full");
  const src = attempt ? `${full}?retry=${attempt}` : full;

  useEffect(() => {
    const element = image.current;
    if (element?.complete) setStatus(element.naturalWidth ? "loaded" : "failed");
  }, [src, attempt]);

  useEffect(() => {
    if (status !== "loaded") return;
    const timer = window.setTimeout(() => setPreviewing(false), 210);
    return () => window.clearTimeout(timer);
  }, [status]);

  return <div className={`page-image ${status}${previewing && status !== "failed" ? " with-preview" : ""}`}
    style={{ "--page-preview": `url("${readerThumbnail(item.asset_id)}")` } as CSSProperties}>
    <img key={attempt} ref={image} src={src} alt={alt} width={item.width} height={item.height}
      loading={eager || attempt ? "eager" : "lazy"} decoding="async" draggable={false}
      onLoad={() => setStatus("loaded")} onError={() => setStatus("failed")} />
    {status === "failed" && <div className="page-image-error">
      <ImageOff size={22} aria-hidden="true" />
      <p>Couldn’t load this page.</p>
      <button className="button secondary" onClick={() => {
        setStatus("loading");
        setPreviewing(true);
        setAttempt(attempt + 1);
      }}>Retry image</button>
    </div>}
  </div>;
}
