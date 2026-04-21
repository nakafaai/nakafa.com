import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  ForumConversationView,
  ReplyTo,
} from "@/components/school/classes/forum/conversation/models";
import { areConversationViewsEqual } from "@/components/school/classes/forum/conversation/utils/view";

function createSessionState() {
  return {
    conversationSessionVersions: {} as Partial<
      Record<Id<"schoolClassForums">, number>
    >,
    isHydrated: false,
    replyTo: null as ReplyTo | null,
    savedConversationViews: {} as Partial<
      Record<Id<"schoolClassForums">, ForumConversationView>
    >,
  };
}

type ForumSessionState = ReturnType<typeof createSessionState>;

interface PersistedForumSessionState {
  savedConversationViews: ForumSessionState["savedConversationViews"];
}

export type ForumSessionStore = ForumSessionState & {
  clearTransientConversationState: () => void;
  restartConversationSession: (forumId: Id<"schoolClassForums">) => void;
  saveConversationView: (
    forumId: Id<"schoolClassForums">,
    view: ForumConversationView
  ) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
};

/** Creates one class-scoped forum session store with same-tab persistence only. */
export function createForumSessionStore(classId: string) {
  let syncHydrationState: ((isHydrated: boolean) => void) | null = null;

  const store = createStore<ForumSessionStore>()(
    persist(
      immer((set, get) => {
        syncHydrationState = (isHydrated) => {
          set((state) => {
            state.isHydrated = isHydrated;
          });
        };

        return {
          ...createSessionState(),

          clearTransientConversationState: () => {
            set((state) => {
              state.replyTo = null;
            });
          },

          restartConversationSession: (forumId) => {
            set((state) => {
              state.conversationSessionVersions[forumId] =
                (state.conversationSessionVersions[forumId] ?? 0) + 1;
            });
          },

          saveConversationView: (forumId, view) => {
            const savedView = get().savedConversationViews[forumId];

            if (areConversationViewsEqual(savedView, view)) {
              return;
            }

            set((state) => {
              state.savedConversationViews[forumId] = view;
            });
          },

          setReplyTo: (replyTo) => {
            set((state) => {
              state.replyTo = replyTo;
            });
          },
        };
      }),
      {
        migrate: (persistedState, version) => {
          if (
            version >= 8 ||
            !persistedState ||
            typeof persistedState !== "object"
          ) {
            return persistedState as PersistedForumSessionState;
          }

          return {
            savedConversationViews: {},
          } satisfies PersistedForumSessionState;
        },
        name: `forum-ui:${classId}`,
        onRehydrateStorage: () => () => {
          syncHydrationState?.(true);
        },
        partialize: (state): PersistedForumSessionState => ({
          savedConversationViews: state.savedConversationViews,
        }),
        storage: createJSONStorage(() => sessionStorage),
        version: 8,
      }
    )
  );

  return store;
}
