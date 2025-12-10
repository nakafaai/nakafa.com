"use client";

import { type ReactNode, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createForumStore, type ForumStore } from "@/lib/store/forum";

type ForumStoreApi = ReturnType<typeof createForumStore>;

export const ForumContext = createContext<ForumStoreApi | null>(null);

export function ForumContextProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<ForumStoreApi>(undefined);

  if (!storeRef.current) {
    storeRef.current = createForumStore();
  }

  return (
    <ForumContext.Provider value={storeRef.current}>
      {children}
    </ForumContext.Provider>
  );
}

export function useForum<T>(selector: (state: ForumStore) => T): T {
  const ctx = useContextSelector(ForumContext, (context) => context);
  if (!ctx) {
    throw new Error("useForum must be used within a ForumContextProvider");
  }
  return useStore(ctx, useShallow(selector));
}
