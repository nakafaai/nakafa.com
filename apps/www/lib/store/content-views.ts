import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";

interface State {
  viewedSlugs: Set<string>;
  pendingViews: Map<string, number>;
}

interface Actions {
  markAsViewed: (slug: string) => void;
  isViewed: (slug: string) => boolean;
  startView: (slug: string) => void;
  getDuration: (slug: string) => number | null;
  clearView: (slug: string) => void;
}

export type ContentViewsStore = State & Actions;

const initialState: State = {
  viewedSlugs: new Set(),
  pendingViews: new Map(),
};

export const createContentViewsStore = () =>
  createStore<ContentViewsStore>()(
    immer((set, get) => ({
      ...initialState,

      markAsViewed: (slug) =>
        set((state) => {
          state.viewedSlugs.add(slug);
          state.pendingViews.delete(slug);
        }),

      isViewed: (slug) => get().viewedSlugs.has(slug),

      startView: (slug) =>
        set((state) => {
          state.pendingViews.set(slug, Date.now());
        }),

      /**
       * Calculate duration without deleting the pending view.
       * Use this to get duration before attempting mutation.
       */
      getDuration: (slug) => {
        const startTime = get().pendingViews.get(slug);
        if (!startTime) {
          return null;
        }
        return Math.floor((Date.now() - startTime) / 1000);
      },

      /**
       * Clear the pending view after successful mutation.
       * Separated from getDuration to handle mutation failures gracefully.
       */
      clearView: (slug) =>
        set((state) => {
          state.pendingViews.delete(slug);
        }),
    }))
  );
