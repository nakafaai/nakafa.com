import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  areConversationViewsEqual,
  type ConversationView,
} from "@/components/school/classes/forum/conversation/data/view";

interface State {
  backStack: ConversationView[];
  hasOverflow: boolean;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  isAtBottom: boolean;
  settledView: ConversationView | null;
}

interface Actions {
  clearBackStack: () => void;
  clearHighlightedPost: () => void;
  highlightPost: (postId: Id<"schoolClassForumPosts">) => void;
  popBackView: () => ConversationView | null;
  pushBackView: (view: ConversationView) => void;
  setSettledView: (view: ConversationView | null) => void;
  updateViewport: (state: {
    hasOverflow?: boolean;
    isAtBottom?: boolean;
  }) => void;
}

export type ViewportStore = State & Actions;

const initialState: State = {
  backStack: [],
  hasOverflow: false,
  highlightedPostId: null,
  isAtBottom: true,
  settledView: null,
};

/** Creates the per-conversation UI-intent store for transcript navigation state. */
export function createViewportStore() {
  return createStore<ViewportStore>()(
    immer((set, get) => ({
      ...initialState,

      clearBackStack: () => {
        if (get().backStack.length === 0) {
          return;
        }

        set((state) => {
          state.backStack = [];
        });
      },

      clearHighlightedPost: () => {
        if (!get().highlightedPostId) {
          return;
        }

        set((state) => {
          state.highlightedPostId = null;
        });
      },

      highlightPost: (postId) => {
        if (get().highlightedPostId === postId) {
          return;
        }

        set((state) => {
          state.highlightedPostId = postId;
        });
      },

      popBackView: () => {
        const view = get().backStack.at(-1) ?? null;

        if (!view) {
          return null;
        }

        set((state) => {
          state.backStack.pop();
        });

        return view;
      },

      pushBackView: (view) => {
        const current = get().backStack.at(-1);

        if (areConversationViewsEqual(current, view)) {
          return;
        }

        set((state) => {
          state.backStack.push(view);
        });
      },

      setSettledView: (view) => {
        if (areConversationViewsEqual(get().settledView, view)) {
          return;
        }

        set((state) => {
          state.settledView = view;
        });
      },

      updateViewport: (viewport) => {
        const current = get();
        const nextHasOverflow = viewport.hasOverflow ?? current.hasOverflow;
        const nextIsAtBottom = viewport.isAtBottom ?? current.isAtBottom;

        if (
          nextHasOverflow === current.hasOverflow &&
          nextIsAtBottom === current.isAtBottom
        ) {
          return;
        }

        set((state) => {
          if (viewport.hasOverflow !== undefined) {
            state.hasOverflow = viewport.hasOverflow;
          }

          if (viewport.isAtBottom !== undefined) {
            state.isAtBottom = viewport.isAtBottom;
          }
        });
      },
    }))
  );
}
