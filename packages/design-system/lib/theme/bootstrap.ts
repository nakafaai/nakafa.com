import {
  concreteThemeValues,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type ThemeValue,
  themes,
} from "@repo/design-system/lib/theme/registry";

const themeAppearances = Object.fromEntries(
  themes.map((theme) => [theme.value, theme.appearance])
);

/**
 * Builds the synchronous document script that applies persisted theme state
 * before the browser's first paint.
 */
export function createThemeBootstrapScript(
  defaultTheme: ThemeValue = DEFAULT_THEME
) {
  const configuration = JSON.stringify({
    appearances: themeAppearances,
    concreteThemes: concreteThemeValues,
    defaultTheme,
    storageKey: THEME_STORAGE_KEY,
  });

  return `(function(c){var d=document.documentElement,t=c.defaultTheme,s;try{s=localStorage.getItem(c.storageKey)}catch(e){}if(s)t=s;if(t==="system"){try{t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){t="light"}}d.classList.remove(...c.concreteThemes);d.classList.add(t);d.style.colorScheme=c.appearances[t]==="dark"?"dark":"light"})(${configuration})`;
}
