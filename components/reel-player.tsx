"use client";

import { useEffect, useRef, useState } from "react";

type Player = {
  playVideo(): void; pauseVideo(): void; mute(): void; unMute(): void; isMuted(): boolean;
  getDuration(): number; getCurrentTime(): number; destroy(): void;
};
type PlayerApi = {
  Player: new (frame: HTMLIFrameElement, config: { events: {
    onReady: (event: { target: Player }) => void;
    onStateChange: (event: { data: number }) => void;
    onError: () => void;
  } }) => Player;
};
type YouTubeWindow = Window & { YT?: PlayerApi; onYouTubeIframeAPIReady?: () => void };
let loading: Promise<PlayerApi> | undefined;

function loadYouTube() {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const previous = host.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(fail, 10_000);
    function cleanup() {
      window.clearTimeout(timeout);
      host.onYouTubeIframeAPIReady = previous;
    }
    function fail() {
      cleanup();
      script.remove();
      loading = undefined;
      reject(new Error("The video player could not load."));
    }
    host.onYouTubeIframeAPIReady = () => {
      if (!host.YT?.Player) { fail(); return; }
      cleanup();
      resolve(host.YT);
      previous?.();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}

export function ReelPlayer({ id, title }: { id: string; title: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const player = useRef<Player | undefined>(undefined);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = frame.current;
    if (!container) return;
    let active = true;
    const iframe = document.createElement("iframe");
    const query = new URLSearchParams({ enablejsapi: "1", playsinline: "1", loop: "1", playlist: id, origin: window.location.origin });
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?${query}`;
    iframe.title = `${title} video`;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    container.append(iframe);
    const timeout = window.setTimeout(() => { if (active) setStatus("failed"); }, 14_000);
    void loadYouTube().then((api) => {
      if (!active) return;
      player.current = new api.Player(iframe, { events: {
        onReady: ({ target }) => {
          if (!active) return;
          window.clearTimeout(timeout);
          target.mute();
          setStatus("ready");
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) target.playVideo();
        },
        onStateChange: ({ data }) => {
          if (!active) return;
          setPlaying(data === 1);
          if (player.current) setMuted(player.current.isMuted());
        },
        onError: () => { if (active) { setPlaying(false); setStatus("failed"); } },
      } });
    }).catch(() => { if (active) setStatus("failed"); });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      player.current?.destroy();
      player.current = undefined;
      container.replaceChildren();
    };
  }, [id, title]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const instance = player.current;
      const duration = instance?.getDuration();
      if (duration && instance) setProgress(instance.getCurrentTime() / duration);
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <>
    <div ref={frame} className="reel-video" />
    <div className="reel-playback">
      {status === "ready" && <>
        <button type="button" className="button secondary" onClick={() => playing ? player.current?.pauseVideo() : player.current?.playVideo()}>{playing ? "Pause" : "Play"}</button>
        <button type="button" className="button secondary" onClick={() => {
          const instance = player.current;
          if (!instance) return;
          if (instance.isMuted()) { instance.unMute(); setMuted(false); } else { instance.mute(); setMuted(true); }
        }}>{muted ? "Unmute" : "Mute"}</button>
        <progress value={progress} max={1} aria-label="Clip progress" />
      </>}
      {status === "loading" && <p role="status">Loading clip…</p>}
      {status === "failed" && <p role="status">This clip couldn’t load. <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">Watch on YouTube</a></p>}
    </div>
  </>;
}
