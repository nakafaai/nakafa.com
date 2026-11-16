"use client";

import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode, useState } from "react";
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
  const ctx = useRequired(ContentViewsContext, "useContentViews");
  return useStore(ctx, useShallow(selector));
}
