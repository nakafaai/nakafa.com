"use client";

import { type ReactNode, useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  type ContentViewsStore,
  createContentViewsStore,
} from "@/lib/store/content-views";

type ContentViewsStoreApi = ReturnType<typeof createContentViewsStore>;

export const ContentViewsContext = createContext<ContentViewsStoreApi | null>(
  null
);

export function ContentViewsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createContentViewsStore());

  return (
    <ContentViewsContext.Provider value={store}>
      {children}
    </ContentViewsContext.Provider>
  );
}

export function useContentViews<T>(
  selector: (state: ContentViewsStore) => T
): T {
  const ctx = useContextSelector(ContentViewsContext, (c) => c);
  if (!ctx) {
    throw new Error("useContentViews must be used within ContentViewsProvider");
  }
  return useStore(ctx, useShallow(selector));
}
