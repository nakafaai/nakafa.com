import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";

interface State {
  hasPendingLatestPosts: boolean;
  isAtBottom: boolean;
  latestRequest: number;
}

interface Actions {
  scrollToLatest: () => void;
  updateViewport: (state: {
    hasPendingLatestPosts?: boolean;
    isAtBottom?: boolean;
  }) => void;
}

export type ViewportStore = State & Actions;

const initialState: State = {
  hasPendingLatestPosts: false,
  isAtBottom: true,
  latestRequest: 0,
};

/** Creates the viewport store for latest-button and bottom state. */
export function createViewportStore() {
  return createStore<ViewportStore>()(
    immer((set) => ({
      ...initialState,

      scrollToLatest: () => {
        set((state) => {
          state.hasPendingLatestPosts = false;
          state.latestRequest += 1;
        });
      },

      updateViewport: (viewport) => {
        set((state) => {
          if (viewport.hasPendingLatestPosts !== undefined) {
            state.hasPendingLatestPosts = viewport.hasPendingLatestPosts;
          }

          if (viewport.isAtBottom !== undefined) {
            state.isAtBottom = viewport.isAtBottom;
          }
        });
      },
    }))
  );
}
