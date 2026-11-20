"use client";

import { useRequired } from "@repo/design-system/hooks/required";
import type { ReactNode } from "react";
import { createContext, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { ContentViewsStore } from "@/lib/content/views/store";
import { createContentViewsStore } from "@/lib/content/views/store";

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
