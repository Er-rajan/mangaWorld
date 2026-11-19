"use client";

import { ChevronDown, Palette } from "lucide-react";
import { useEffect } from "react";
import { getLocal, setLocal, useLocal } from "@/lib/local";
import { resolveTheme, themes } from "@/lib/themes";

export function ThemeSync() {
  const theme = useLocal("theme");
  useEffect(() => {
    const current = getLocal("theme");
    document.documentElement.dataset.theme = current;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themes[current].color);
  }, [theme]);
  return null;
}

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const theme = useLocal("theme");
  return <label className={compact ? "theme-picker compact" : "theme-picker"}>
    <Palette size={18} aria-hidden="true" />
    <select aria-label="Site theme" title="Site theme" value={theme} onChange={(event) => {
      setLocal("theme", resolveTheme(event.target.value));
    }}>
      {Object.entries(themes).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}
    </select>
    <ChevronDown size={14} aria-hidden="true" />
  </label>;
}
