"use client";

import { useEffect } from "react";
import { readMe } from "@/lib/me";
import { DEFAULT_THEME, readTheme, THEME_EVENT, themeStyle } from "@/lib/theme";

export default function ThemeProvider() {
  useEffect(() => {
    function apply() {
      const me = readMe();
      const theme = me ? readTheme(me) : DEFAULT_THEME;
      const style = themeStyle(theme);
      for (const [key, value] of Object.entries(style)) {
        if (key.startsWith("--")) document.documentElement.style.setProperty(key, String(value));
      }
      document.documentElement.style.fontSize = `${theme.size}px`;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.accent);
    }
    apply();
    window.addEventListener(THEME_EVENT, apply);
    window.addEventListener("storage", apply);
    return () => { window.removeEventListener(THEME_EVENT, apply); window.removeEventListener("storage", apply); };
  }, []);
  return null;
}
