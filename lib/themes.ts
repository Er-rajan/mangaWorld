export const classicThemes = {
  dark: { label: "Neon Night", color: "#11111a", light: false },
  sakura: { label: "Sakura", color: "#fff6f9", light: true },
  ink: { label: "Manga Ink", color: "#151515", light: false },
  light: { label: "Daylight", color: "#fffaf2", light: true },
} as const;

export const animalThemes = {
  fox: { label: "Amber Fox", color: "#1c1612", light: false },
  rabbit: { label: "Snow Rabbit", color: "#f6f2fa", light: true },
  owl: { label: "Midnight Owl", color: "#101723", light: false },
} as const;

export const themes = { ...classicThemes, ...animalThemes };
export type Theme = keyof typeof themes;
export const defaultTheme: Theme = "fox";
export const themeStorageKey = "nightfolio:theme";

export function resolveTheme(value: string | null): Theme {
  return value && Object.hasOwn(themes, value) ? value as Theme : defaultTheme;
}
