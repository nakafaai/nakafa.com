import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  areConversationViewsEqual,
  type ConversationView,
} from "@/components/school/classes/forum/conversation/data/view";

interface State {
  backOrigin: ConversationView | null;
  hasPendingLatestPosts: boolean;
  isAtBottom: boolean;
  mode: "focused" | "live";
}

interface Actions {
  clearBackOrigin: () => void;
  setBackOrigin: (view: ConversationView | null) => void;
  setMode: (mode: State["mode"]) => void;
  updateViewport: (state: {
    hasPendingLatestPosts?: boolean;
    isAtBottom?: boolean;
  }) => void;
}

export type ViewportStore = State & Actions;

const initialState: State = {
  backOrigin: null,
  hasPendingLatestPosts: false,
  isAtBottom: true,
  mode: "live",
};

/** Creates the per-conversation UI-intent store for the transcript viewport. */
export function createViewportStore() {
  return createStore<ViewportStore>()(
    immer((set, get) => ({
      ...initialState,

      clearBackOrigin: () => {
        if (!get().backOrigin) {
          return;
        }

        set((state) => {
          state.backOrigin = null;
        });
      },

      setBackOrigin: (view) => {
        if (areConversationViewsEqual(get().backOrigin, view)) {
          return;
        }

        set((state) => {
          state.backOrigin = view;
        });
      },

      setMode: (mode) => {
        if (get().mode === mode) {
          return;
        }

        set((state) => {
          state.mode = mode;
        });
      },

      updateViewport: (viewport) => {
        const current = get();
        const nextHasPendingLatestPosts =
          viewport.hasPendingLatestPosts ?? current.hasPendingLatestPosts;
        const nextIsAtBottom = viewport.isAtBottom ?? current.isAtBottom;

        if (
          nextHasPendingLatestPosts === current.hasPendingLatestPosts &&
          nextIsAtBottom === current.isAtBottom
        ) {
          return;
        }

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
