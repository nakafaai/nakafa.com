import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

/**
 * Tracks content views to prevent duplicate recording.
 *
 * Design: Once a content is viewed, it's marked forever (no expiry).
 * This prevents view count inflation and ensures 1 view = 1 person.
 */

interface State {
  viewedSlugs: Record<string, number>;
}

interface Actions {
  isViewed: (slug: string) => boolean;
  markAsViewed: (slug: string) => void;
}

export type ContentViewsStore = State & Actions;

const initialState: State = {
  viewedSlugs: {},
};

export const createContentViewsStore = () =>
  createStore<ContentViewsStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,

        markAsViewed: (slug) =>
          set((state) => {
            state.viewedSlugs[slug] = Date.now();
          }),

        /**
         * Checks if content has been viewed.
         * Returns true if viewed (no expiry - once viewed, always viewed).
         */
        isViewed: (slug) => {
          return slug in get().viewedSlugs;
        },
      })),
      {
        name: "nakafa-content-views",
        version: 1,
      }
    )
  );
