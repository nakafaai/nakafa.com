import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

/**
 * Tracks content views to prevent rapid duplicate recording within session.
 *
 * Design: Local deduplication prevents spam.
 * Backend tracks first and last view timestamps for accurate analytics.
 */

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

interface State {
  viewedSlugs: Record<string, number>;
}

interface Actions {
  isViewed: (key: string) => boolean;
  markAsViewed: (key: string) => void;
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

        markAsViewed: (key) =>
          set((state) => {
            state.viewedSlugs[key] = Date.now();
          }),

        /**
         * Checks if content has been viewed in current session.
         * Returns true if viewed within TTL (30 minutes).
         * Allows re-views after TTL expires to update backend lastViewedAt.
         */
        isViewed: (key) => {
          const viewedAt = get().viewedSlugs[key];
          if (viewedAt === undefined) {
            return false;
          }
          return Date.now() - viewedAt < SESSION_TTL;
        },
      })),
      {
        name: "nakafa-content-views",
        version: 1,
      }
    )
  );
