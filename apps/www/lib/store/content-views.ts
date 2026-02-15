import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

/**
 * Tracks content views to prevent duplicate recording within expiry window.
 */

const VIEW_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface State {
  viewedSlugs: Record<string, number>;
}

interface Actions {
  markAsViewed: (slug: string) => void;
  isViewed: (slug: string) => boolean;
  clearExpired: () => void;
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

        isViewed: (slug) => {
          const timestamp = get().viewedSlugs[slug];
          if (!timestamp) {
            return false;
          }
          return Date.now() - timestamp < VIEW_EXPIRY_MS;
        },

        clearExpired: () =>
          set((state) => {
            const now = Date.now();
            for (const [slug, timestamp] of Object.entries(state.viewedSlugs)) {
              if (now - timestamp >= VIEW_EXPIRY_MS) {
                delete state.viewedSlugs[slug];
              }
            }
          }),
      })),
      {
        name: "nakafa-content-views",
        version: 1,
      }
    )
  );
