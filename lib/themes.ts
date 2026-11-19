export const themes = {
  dark: { label: "Neon Night", color: "#11111a", light: false },
  sakura: { label: "Sakura", color: "#fff6f9", light: true },
  ink: { label: "Manga Ink", color: "#151515", light: false },
  light: { label: "Daylight", color: "#fffaf2", light: true },
} as const;

export type Theme = keyof typeof themes;
export const defaultTheme: Theme = "dark";
export const themeStorageKey = "nightfolio:theme";

export function resolveTheme(value: string | null): Theme {
  return value && Object.hasOwn(themes, value) ? value as Theme : defaultTheme;
}
