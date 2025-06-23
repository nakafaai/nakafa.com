"use client";

import { type ReactNode, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createSearchStore, type SearchStore } from "@/lib/store/search";

type SearchStoreApi = ReturnType<typeof createSearchStore>;

export const SearchContext = createContext<SearchStoreApi | null>(null);

export function SearchContextProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<SearchStoreApi>(undefined);

  if (!storeRef.current) {
    storeRef.current = createSearchStore();
  }

  return (
    <SearchContext.Provider value={storeRef.current}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch<T>(selector: (state: SearchStore) => T): T {
  const ctx = useContextSelector(SearchContext, (context) => context);
  if (!ctx) {
    throw new Error("useSearch must be used within a SearchContextProvider");
  }
  return useStore(ctx, useShallow(selector));
}
