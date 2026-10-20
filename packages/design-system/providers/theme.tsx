"use client";

import {
  connectThemeStore,
  createThemeStore,
  type ThemeState,
  type ThemeStore,
} from "@repo/design-system/lib/theme/store";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useStore } from "zustand";

const ThemeContext = createContext<ThemeStore | null>(null);

/**
 * Provides the visitor's theme to every reader below it. The store is created
 * once per provider, and the context carries only that store, which never
 * changes after hydration: React client-renders a streamed Suspense boundary
 * that is still pending when an ancestor context changes, and that discards the
 * HTML the server sent. Readers select the part they need, and the store's
 * server snapshot is the state the server rendered.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createThemeStore);

  useEffect(() => connectThemeStore(store), [store]);

  return <ThemeContext value={store}>{children}</ThemeContext>;
}

/** Returns the theme store and rejects a missing provider. */
function useThemeStore(): ThemeStore {
  const store = use(ThemeContext);
  if (store === null) {
    throw new TypeError("useTheme must be used within ThemeProvider");
  }
  return store;
}

/**
 * Selects one part of the theme: the stored choice, the theme it resolves to,
 * or setTheme. A reader re-renders only when its selection changes.
 */
export function useTheme<Selected>(
  selector: (state: ThemeState) => Selected
): Selected {
  return useStore(useThemeStore(), selector);
}
