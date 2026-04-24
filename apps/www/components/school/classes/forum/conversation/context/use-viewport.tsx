"use client";

import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  createViewportStore,
  ViewportStore,
} from "@/components/school/classes/forum/conversation/store/viewport";

type ViewportStoreApi = ReturnType<typeof createViewportStore>;

const ViewportContext = createContext<ViewportStoreApi | null>(null);

/** Provides one forum-scoped viewport store. */
export function ViewportProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: ViewportStoreApi;
}) {
  return (
    <ViewportContext.Provider value={store}>
      {children}
    </ViewportContext.Provider>
  );
}

/** Reads one selected slice from the forum conversation viewport store. */
export function useViewport<T>(selector: (state: ViewportStore) => T) {
  const store = useContextSelector(ViewportContext, (value) => value);

  if (!store) {
    throw new Error("useViewport must be used within a ConversationProvider");
  }

  return useStore(store, useShallow(selector));
}
