"use client";

import { type SearchStore, createSearchStore } from "@/lib/store/search";
import { type ReactNode, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

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
  const context = useContextSelector(SearchContext, (context) => context);
  if (!context) {
    throw new Error("useSearch must be used within a SearchContextProvider");
  }
  return useStore(context, useShallow(selector));
}
