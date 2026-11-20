"use client";

import { useSyncExternalStore } from "react";
import type { ReaderLayout } from "./types";
import { defaultTheme, resolveTheme, themeStorageKey, type Theme } from "./themes";

export type SavedPage = {
  path: string; series: string; chapter: string; page: number; total: number; updated: number;
};
export type PageTransition = "fade" | "slide" | "page-flip";
export type ReaderPrefs = ReaderLayout & { zoom: number; brightness: number; background: "ink" | "paper" | "gray";
  transition?: PageTransition };
export const defaultReader: ReaderPrefs = { mode: "vertical", direction: "rtl", zoom: 100, brightness: 100, background: "ink", transition: "fade" };

type LocalValues = {
  theme: Theme;
  follows: string[];
  progress: Record<string, SavedPage>;
  bookmarks: SavedPage[];
  prefs: ReaderPrefs;
  seriesLayouts: Record<string, ReaderLayout>;
  tapGuideSeen: boolean;
  catalogueNoticeDismissed: boolean;
  visitor: string;
  likes: string[];
};
const defaults: LocalValues = { theme: defaultTheme, follows: [], progress: {}, bookmarks: [], prefs: defaultReader,
  seriesLayouts: {}, tapGuideSeen: false, catalogueNoticeDismissed: false, visitor: "", likes: [] };
const data = new Map<string, { raw: string | null; value: unknown }>();
const prefix = "nightfolio:";
const changed = "nightfolio-local";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changed, callback); };
}

export function getLocal<K extends keyof LocalValues>(key: K): LocalValues[K] {
  try {
    const raw = window.localStorage.getItem(key === "theme" ? themeStorageKey : prefix + key);
    const cached = data.get(key);
    if (cached !== undefined && cached.raw === raw) return cached.value as LocalValues[K];
    const value = raw === null ? defaults[key] : key === "theme" ? resolveTheme(raw) : JSON.parse(raw);
    data.set(key, { raw, value });
    return value;
  } catch {
    return (data.get(key)?.value as LocalValues[K] | undefined) ?? defaults[key];
  }
}

export function setLocal<K extends keyof LocalValues>(key: K, value: LocalValues[K]) {
  const raw = key === "theme" ? String(value) : JSON.stringify(value);
  data.set(key, { raw, value });
  try { window.localStorage.setItem(key === "theme" ? themeStorageKey : prefix + key, raw); } catch { /* Keep the setting for this tab. */ }
  window.dispatchEvent(new Event(changed));
}

export function useLocal<K extends keyof LocalValues>(key: K): LocalValues[K] {
  return useSyncExternalStore(subscribe, () => getLocal(key), () => defaults[key]);
}

export function rememberProgress(entry: SavedPage) {
  const progress = getLocal("progress");
  const next = Object.fromEntries(Object.entries({ ...progress, [entry.path]: entry })
    .sort(([, a], [, b]) => b.updated - a.updated).slice(0, 100));
  setLocal("progress", next);
}

export function visitorId() {
  const id = getLocal("visitor");
  if (id) return id;
  if (!globalThis.crypto?.randomUUID) return "";
  const created = crypto.randomUUID();
  setLocal("visitor", created);
  return created;
}
