import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// 24 hours in milliseconds - views expire after this time
const VIEW_EXPIRY_MS = 24 * 60 * 60 * 1000;

interface State {
  /**
   * Map of viewed slugs to timestamp (when viewed).
   * Using Record instead of Set for JSON serialization (required for persistence).
   * Keys are slugs, values are timestamps (Date.now()).
   */
  viewedSlugs: Record<string, number>;
  /**
   * Map of pending views (in progress) to start timestamp.
   * Used to calculate duration when view is recorded.
   */
  pendingViews: Record<string, number>;
}

interface Actions {
  /** Mark a slug as viewed (with current timestamp) */
  markAsViewed: (slug: string) => void;
  /** Check if slug was viewed within expiry window */
  isViewed: (slug: string) => boolean;
  /** Start tracking a view (record start time) */
  startView: (slug: string) => void;
  /** Get duration in seconds since view started */
  getDuration: (slug: string) => number | null;
  /** Clear a pending view after successful recording */
  clearView: (slug: string) => void;
  /** Clear expired viewed slugs (call periodically) */
  clearExpired: () => void;
}

export type ContentViewsStore = State & Actions;

const initialState: State = {
  viewedSlugs: {},
  pendingViews: {},
};

export const createContentViewsStore = () =>
  createStore<ContentViewsStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,

        markAsViewed: (slug) =>
          set((state) => {
            state.viewedSlugs[slug] = Date.now();
            delete state.pendingViews[slug];
          }),

        isViewed: (slug) => {
          const timestamp = get().viewedSlugs[slug];
          if (!timestamp) {
            return false;
          }
          // Check if view is still within expiry window
          return Date.now() - timestamp < VIEW_EXPIRY_MS;
        },

        startView: (slug) =>
          set((state) => {
            state.pendingViews[slug] = Date.now();
          }),

        getDuration: (slug) => {
          const startTime = get().pendingViews[slug];
          if (!startTime) {
            return null;
          }
          return Math.floor((Date.now() - startTime) / 1000);
        },

        clearView: (slug) =>
          set((state) => {
            delete state.pendingViews[slug];
          }),

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
        // Only persist viewedSlugs, not pendingViews (session-only)
        partialize: (state) => ({ viewedSlugs: state.viewedSlugs }),
      }
    )
  );
