"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { readerThumbnail } from "@/lib/format";
import type { PageArt } from "@/lib/types";

const hideDelay = 3200;

export function useReaderChrome() {
  const [hidden, setHidden] = useState(false);
  const lastActivity = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(() => {
    lastActivity.current = performance.now();
    setHidden(false);
    if (timer.current !== undefined) return;
    function check() {
      const remaining = hideDelay - (performance.now() - lastActivity.current);
      if (remaining > 0) { timer.current = window.setTimeout(check, remaining); return; }
      timer.current = undefined;
      setHidden(true);
    }
    timer.current = window.setTimeout(check, hideDelay);
  }, []);

  useEffect(() => {
    show();
    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "mouse") show();
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("keydown", show);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", show);
      window.clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [show]);
  return { hidden, show };
}

export function PageScrubber({ page, pages, cover, rtl, onJump }: {
  page: number; pages: PageArt[]; cover: string | null; rtl: boolean; onJump: (page: number) => void;
}) {
  const minimum = cover ? 0 : 1;
  const maximum = pages.length;
  const [draft, setDraft] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const dragging = useRef(false);
  const target = draft ?? hover ?? (focused ? page : null);
  const asset = target === 0 ? cover : target === null ? null : pages[target - 1]?.asset_id;
  const src = asset ? readerThumbnail(asset) : null;
  const [preview, setPreview] = useState<string | null>(null);
  const fraction = (target === null || maximum === minimum) ? 0.5 : (target - minimum) / (maximum - minimum);
  const previewPosition = `${(rtl ? 1 - fraction : fraction) * 100}%`;

  useEffect(() => {
    const timer = window.setTimeout(() => setPreview(src), 80);
    return () => window.clearTimeout(timer);
  }, [src]);

  return <div className="reader-scrubber">
    <label htmlFor="reader-page-slider">Page</label>
    <div className="scrubber-track">
      {target !== null && <div className="scrubber-preview" aria-hidden="true"
        style={{ "--preview-position": previewPosition } as CSSProperties}>
        <div className="scrubber-thumbnail">
          {preview && preview === src && <img key={preview} src={preview} alt="" decoding="async"
            onError={(event) => { event.currentTarget.hidden = true; }} />}
        </div>
        <span>{target === 0 ? "Cover" : `Page ${target}`}</span>
      </div>}
      <input id="reader-page-slider" type="range" min={minimum} max={maximum} value={draft ?? page} dir={rtl ? "rtl" : "ltr"}
        disabled={maximum <= minimum} aria-valuetext={(draft ?? page) === 0 ? "Cover" : `Page ${draft ?? page} of ${maximum}`}
        onFocus={(event) => setFocused(event.currentTarget.matches(":focus-visible"))} onBlur={() => setFocused(false)}
        onKeyDown={() => setFocused(true)}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" || dragging.current) return;
          const { left, width } = event.currentTarget.getBoundingClientRect();
          const position = Math.min(1, Math.max(0, (event.clientX - left - 8) / Math.max(1, width - 16)));
          setHover(Math.round(minimum + (rtl ? 1 - position : position) * (maximum - minimum)));
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          setFocused(false);
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDraft(Number(event.currentTarget.value));
        }}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (dragging.current) setDraft(value); else onJump(value);
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          onJump(Number(event.currentTarget.value));
          setDraft(null);
        }}
        onLostPointerCapture={() => { dragging.current = false; setDraft(null); }} />
    </div>
    <span aria-hidden="true">{(draft ?? page) === 0 ? "Cover" : `${draft ?? page} / ${maximum}`}</span>
  </div>;
}
