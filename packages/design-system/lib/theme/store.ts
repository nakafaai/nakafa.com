import {
  type ConcreteTheme,
  concreteThemeValues,
  DEFAULT_THEME,
  getThemeAppearance,
  parseThemeChoice,
  resolveThemeChoice,
  THEME_STORAGE_KEY,
  type ThemeAppearance,
  type ThemeChoice,
} from "@repo/design-system/lib/theme/registry";
import { Effect, Option } from "effect";
import { createStore, type StoreApi } from "zustand";

/** The query that matches while the system asks for a dark appearance. */
const DARK_SYSTEM_QUERY = "(prefers-color-scheme: dark)";

/** Turns every transition off, so a theme change paints at once. */
const NO_TRANSITIONS_CSS =
  "*, *::before, *::after { transition: none !important; }";

/** The visitor's choice, the theme it resolves to, and the action that changes the choice. */
export interface ThemeState {
  readonly resolvedTheme: ConcreteTheme;
  readonly setTheme: (theme: ThemeChoice) => void;
  readonly systemAppearance: ThemeAppearance;
  readonly theme: ThemeChoice;
}

/** The store of one provider instance. */
export type ThemeStore = StoreApi<ThemeState>;

/** The state that a choice and the system appearance determine together. */
function themeSnapshot(theme: ThemeChoice, systemAppearance: ThemeAppearance) {
  return {
    resolvedTheme: resolveThemeChoice(theme, systemAppearance),
    systemAppearance,
    theme,
  };
}

/** Reads the stored choice. Storage that refuses the read has no stored choice. */
const readStoredChoice = Effect.fn("designSystem.theme.readStoredChoice")(
  function* () {
    const stored = yield* Effect.try(() =>
      window.localStorage.getItem(THEME_STORAGE_KEY)
    ).pipe(
      Effect.map(Option.fromNullishOr),
      Effect.orElseSucceed(() => Option.none<string>())
    );
    return parseThemeChoice(stored);
  }
);

/** Writes the choice. Storage that refuses the write keeps the choice for this page. */
const saveChoice = Effect.fn("designSystem.theme.saveChoice")(function* (
  theme: ThemeChoice
) {
  yield* Effect.try(() =>
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  ).pipe(Effect.ignore);
});

/**
 * Creates the store of one provider. Its first state is the one the server
 * renders: the system choice under the light appearance, because the server
 * cannot read the visitor's choice or the system appearance.
 */
export function createThemeStore(): ThemeStore {
  return createStore<ThemeState>()((set) => ({
    ...themeSnapshot(DEFAULT_THEME, "light"),
    setTheme: (theme) => {
      Effect.runSync(saveChoice(theme));
      set((state) => themeSnapshot(theme, state.systemAppearance));
    },
  }));
}

/** Turns transitions off until the next frame. Reading layout applies the rule first. */
function suppressTransitions() {
  const style = document.createElement("style");
  style.textContent = NO_TRANSITIONS_CSS;
  document.head.append(style);
  document.documentElement.getBoundingClientRect();
  requestAnimationFrame(() => {
    style.remove();
  });
}

/** Writes the resolved theme to the root element as its class and color scheme. */
function applyResolvedTheme(resolvedTheme: ConcreteTheme) {
  suppressTransitions();
  const root = document.documentElement;
  root.classList.remove(...concreteThemeValues);
  root.classList.add(resolvedTheme);
  root.style.setProperty("color-scheme", getThemeAppearance(resolvedTheme));
}

/** Reads whether the system asks for a dark appearance. */
function readSystemAppearance(query: MediaQueryList): ThemeAppearance {
  return query.matches ? "dark" : "light";
}

/**
 * Connects the store to the browser once the page has hydrated. It reads the
 * stored choice and the system appearance, follows prefers-color-scheme and the
 * storage event of other tabs, and writes the root element on every change. The
 * returned function removes every listener.
 */
export function connectThemeStore(store: ThemeStore): () => void {
  const query = window.matchMedia(DARK_SYSTEM_QUERY);
  const unsubscribe = store.subscribe((state) => {
    applyResolvedTheme(state.resolvedTheme);
  });

  /** Follows the system appearance. A concrete choice keeps its theme. */
  function followSystem() {
    store.setState((state) =>
      themeSnapshot(state.theme, readSystemAppearance(query))
    );
  }

  /** Follows the choice that another tab stored. Cleared storage means no choice. */
  function followStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) {
      return;
    }
    const choice = parseThemeChoice(Option.fromNullishOr(event.newValue));
    store.setState((state) => themeSnapshot(choice, state.systemAppearance));
  }

  store.setState(
    themeSnapshot(
      Effect.runSync(readStoredChoice()),
      readSystemAppearance(query)
    )
  );
  query.addEventListener("change", followSystem);
  window.addEventListener("storage", followStorage);

  return () => {
    unsubscribe();
    query.removeEventListener("change", followSystem);
    window.removeEventListener("storage", followStorage);
  };
}
