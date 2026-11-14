import { Array as Arr } from "effect";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SearchEntry } from "@/lib/search/entry";

/** How many pages the palette remembers that the reader opened from it. */
const RECENT_LIMIT = 5;

/** The pages the reader opened from the palette, newest first, and how to add one. */
interface RecentStore {
  readonly entries: readonly SearchEntry[];
  readonly remember: (entry: SearchEntry) => void;
}

/**
 * Creates the reader's recent pages, kept in this browser only, so the palette
 * opens on what the reader came for last time. A page opened again moves to the
 * front instead of showing twice.
 */
export const createRecentStore = () =>
  createStore<RecentStore>()(
    persist(
      (set) => ({
        entries: [],
        remember: (entry) => {
          set((state) => ({
            entries: Arr.take(
              Arr.prepend(
                Arr.filter(state.entries, ({ path }) => path !== entry.path),
                entry
              ),
              RECENT_LIMIT
            ),
          }));
        },
      }),
      {
        name: "nakafa-search-recent",
        partialize: ({ entries }) => ({ entries }),
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    )
  );
