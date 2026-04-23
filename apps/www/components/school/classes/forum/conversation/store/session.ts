import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ReplyTo } from "@/components/school/classes/forum/conversation/data/entities";
import {
  areConversationViewsEqual,
  type ConversationView,
} from "@/components/school/classes/forum/conversation/data/view";

interface State {
  isHydrated: boolean;
  replyTo: ReplyTo | null;
  savedConversationViews: Partial<
    Record<Id<"schoolClassForums">, ConversationView>
  >;
}

interface Actions {
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ConversationView
  ) => void;
  setHydrated: (isHydrated: boolean) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

export type SessionStore = State & Actions;

const initialState: State = {
  isHydrated: false,
  replyTo: null,
  savedConversationViews: {},
};

/** Creates one class-scoped session store for reply state and semantic restore. */
export function createSessionStore(classId: string) {
  const store = createStore<SessionStore>()(
    persist(
      immer((set, get) => ({
        ...initialState,

        saveConversationView: (forumId, view) => {
          const savedView = get().savedConversationViews[forumId];

          if (areConversationViewsEqual(savedView, view)) {
            return;
          }

          set((state) => {
            state.savedConversationViews[forumId] = view;
          });
        },

        setHydrated: (isHydrated) => {
          set((state) => {
            state.isHydrated = isHydrated;
          });
        },

        setReplyTo: (replyTo) => {
          set((state) => {
            state.replyTo = replyTo;
          });
        },
      })),
      {
        name: `forum-session:${classId}`,
        partialize: (state) => ({
          savedConversationViews: state.savedConversationViews,
        }),
        storage: createJSONStorage(() => sessionStorage),
        version: 2,
      }
    )
  );

  if (store.persist.hasHydrated()) {
    store.setState((state) => ({
      ...state,
      isHydrated: true,
    }));
  }

  return store;
}
