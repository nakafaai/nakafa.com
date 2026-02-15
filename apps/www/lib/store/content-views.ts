import { createStore } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// 24 hours in milliseconds - views expire after this time
const VIEW_EXPIRY_MS = 24 * 60 * 60 * 1000;
// 1 hour - pending views timeout if user navigates away
const PENDING_VIEW_TIMEOUT_MS = 60 * 60 * 1000;

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
  /** Clear expired viewed slugs and stale pending views (call periodically) */
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
          // Protect against clock skew (Date.now() can jump backward)
          // Per best practices: Never send negative durations to backend
          const duration = Math.floor((Date.now() - startTime) / 1000);
          return Math.max(0, duration);
        },

        clearView: (slug) =>
          set((state) => {
            delete state.pendingViews[slug];
          }),

        /**
         * Clear expired entries to prevent memory bloat.
         * - viewedSlugs: Remove entries older than VIEW_EXPIRY_MS (24h)
         * - pendingViews: Remove entries older than PENDING_VIEW_TIMEOUT_MS (1h)
         *   These are orphaned when user navigates away before timer completes.
         */
        clearExpired: () =>
          set((state) => {
            const now = Date.now();
            // Clean expired viewed slugs
            for (const [slug, timestamp] of Object.entries(state.viewedSlugs)) {
              if (now - timestamp >= VIEW_EXPIRY_MS) {
                delete state.viewedSlugs[slug];
              }
            }
            // Clean stale pending views (orphaned when component unmounts mid-tracking)
            for (const [slug, timestamp] of Object.entries(
              state.pendingViews
            )) {
              if (now - timestamp >= PENDING_VIEW_TIMEOUT_MS) {
                delete state.pendingViews[slug];
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
