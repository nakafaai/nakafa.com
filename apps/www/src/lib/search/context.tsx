"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createSearchStore, type SearchStore } from "@/lib/search/store";

type SearchStoreApi = ReturnType<typeof createSearchStore>;

const SearchContext = createContext<SearchStoreApi | null>(null);

export function SearchContextProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSearchStore());

  return <SearchContext value={store}>{children}</SearchContext>;
}

export function useSearch<T>(selector: (state: SearchStore) => T): T {
  const ctx = use(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within a SearchContextProvider");
  }
  return useStore(ctx, useShallow(selector));
}
