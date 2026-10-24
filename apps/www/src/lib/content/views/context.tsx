"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  type ContentViewsStore,
  createContentViewsStore,
} from "@/lib/content/views/store";

type ContentViewsStoreApi = ReturnType<typeof createContentViewsStore>;

const ContentViewsContext = createContext<ContentViewsStoreApi | null>(null);

export function ContentViewsProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createContentViewsStore());

  return <ContentViewsContext value={store}>{children}</ContentViewsContext>;
}

export function useContentViews<T>(
  selector: (state: ContentViewsStore) => T
): T {
  const ctx = use(ContentViewsContext);
  if (!ctx) {
    throw new Error("useContentViews must be used within ContentViewsProvider");
  }
  return useStore(ctx, useShallow(selector));
}
