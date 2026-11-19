"use client";

import { useEffect, useState } from "react";

export function OfflineSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

type OfflineState = "unavailable" | "saving" | "saved" | "failed";

export function useOfflineChapter(path: string, revision: number, artwork: string[]) {
  const [state, setState] = useState<OfflineState>("unavailable");
  const [retry, setRetry] = useState(0);
  const urls = artwork.join("|");
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const channel = new MessageChannel();
    let active = true;
    channel.port1.onmessage = ({ data }) => {
      if (active) setState(data.ok ? "saved" : "failed");
    };
    setState("saving");
    void navigator.serviceWorker.ready.then((registration) => {
      if (!active || !registration.active) return;
      const entries = performance.getEntriesByType("resource").map((item) => item.name);
      registration.active.postMessage({ type: "chapter", path, revision, artwork: urls.split("|").filter(Boolean), entries }, [channel.port2]);
    }).catch(() => { if (active) setState("failed"); });
    return () => { active = false; channel.port1.close(); };
  }, [path, revision, retry, urls]);
  return { state, retry: () => setRetry((count) => count + 1) };
}
