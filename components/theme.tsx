"use client";

import { ChevronDown, Feather, Palette, PawPrint, Rabbit } from "lucide-react";
import { useEffect } from "react";
import { getLocal, setLocal, useLocal } from "@/lib/local";
import { animalThemes, classicThemes, resolveTheme, themes, type Theme } from "@/lib/themes";

const themeIcons: Partial<Record<Theme, typeof Palette>> = { fox: PawPrint, rabbit: Rabbit, owl: Feather };

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
  const Icon = themeIcons[theme] ?? Palette;
  return <label className={compact ? "theme-picker compact" : "theme-picker"}>
    <Icon size={18} aria-hidden="true" />
    <select aria-label="Site theme" title="Site theme" value={theme} onChange={(event) => {
      setLocal("theme", resolveTheme(event.target.value));
    }}>
      <optgroup label="Animal themes">
        {Object.entries(animalThemes).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}
      </optgroup>
      <optgroup label="Classic themes">
        {Object.entries(classicThemes).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}
      </optgroup>
    </select>
    <ChevronDown size={14} aria-hidden="true" />
  </label>;
}
