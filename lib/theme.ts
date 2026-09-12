import type { CSSProperties } from "react";
import type { PersonId } from "./me";

export type Theme = { accent: string; text: string; background: string; size: number; rounded: boolean };
export const DEFAULT_THEME: Theme = { accent: "#ff8fab", text: "#3d2b33", background: "#fff7f9", size: 16, rounded: true };
export const THEME_EVENT = "ddunddi-theme";
const color = (value: unknown, fallback: string) => typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;

export function normalizeTheme(value: unknown): Theme {
  const v = value && typeof value === "object" ? value as Partial<Theme> : {};
  return { accent: color(v.accent, DEFAULT_THEME.accent), text: color(v.text, DEFAULT_THEME.text), background: color(v.background, DEFAULT_THEME.background), size: [14, 16, 18].includes(v.size ?? 0) ? v.size! : 16, rounded: typeof v.rounded === "boolean" ? v.rounded : true };
}
export function readTheme(person: PersonId): Theme {
  try { return normalizeTheme(JSON.parse(localStorage.getItem(`ddunddi-theme-${person}`) ?? "null")); }
  catch { return { ...DEFAULT_THEME }; }
}
export function saveTheme(person: PersonId, theme: Theme) {
  localStorage.setItem(`ddunddi-theme-${person}`, JSON.stringify(normalizeTheme(theme)));
  window.dispatchEvent(new Event(THEME_EVENT));
}
function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
export function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
export function themeStyle(theme: Theme): CSSProperties {
  return {
    "--app-accent": theme.accent, "--app-text": theme.text, "--app-background": theme.background,
    "--app-on-accent": contrast(theme.accent, "#ffffff") >= contrast(theme.accent, "#241e24") ? "#ffffff" : "#241e24",
    "--app-radius": theme.rounded ? "1.5rem" : ".75rem", fontSize: `${theme.size}px`,
  } as CSSProperties;
}
