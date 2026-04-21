import {
  issueScrollRequest,
  syncDerivedState,
} from "@/components/school/classes/forum/conversation/store/runtime/derived";
import {
  applyTimelineWindow,
  showLiveTimeline,
} from "@/components/school/classes/forum/conversation/store/runtime/timeline";
import type {
  ConversationRuntimeActions,
  ConversationVariant,
  RuntimeActionContext,
} from "@/components/school/classes/forum/conversation/store/runtime/types";
import { createFocusedTimelineState } from "@/components/school/classes/forum/conversation/utils/focused";
import { refreshFocusedTimeline } from "@/components/school/classes/forum/conversation/utils/timeline";

/** Creates the store actions that sync external data into runtime state. */
export function createSyncActions({
  get,
  getDeps,
  set,
}: RuntimeActionContext): Pick<
  ConversationRuntimeActions,
  | "acknowledgeUnreadCue"
  | "clearScrollRequest"
  | "handleBottomStateChange"
  | "syncForum"
  | "syncForumStore"
  | "syncLiveWindow"
> {
  return {
    acknowledgeUnreadCue: () => {
      set((state) => {
        state.isUnreadCueAcknowledged = true;
        syncDerivedState(state);
      });
    },

    clearScrollRequest: (requestId) => {
      set((state) => {
        if (state.scrollRequest?.id === requestId) {
          state.scrollRequest = null;
        }
      });
    },

    handleBottomStateChange: (isAtBottom) => {
      set((state) => {
        state.isAtBottom = isAtBottom;
      });
    },

    syncForum: (forum) => {
      set((state) => {
        state.forum = forum;
        syncDerivedState(state);
      });
    },

    syncForumStore: ({ isHydrated, savedConversationView }) => {
      const wasBootstrapped = get().isBootstrapped;
      const nextVariant: ConversationVariant = savedConversationView?.kind
        ? "focused"
        : "live";

      set((state) => {
        state.isHydrated = isHydrated;
        state.savedConversationView = savedConversationView;

        if (!state.isBootstrapped) {
          state.settledConversationView = savedConversationView;
          state.variant = nextVariant;
        }

        syncDerivedState(state);
      });

      if (!isHydrated || wasBootstrapped) {
        return;
      }

      if (savedConversationView?.kind === "post") {
        const requestToken = get().focusRequestToken + 1;

        set((state) => {
          state.focusRequestToken = requestToken;
          state.isBootstrapped = true;
          syncDerivedState(state);
        });

        getDeps()
          .fetchAround(savedConversationView.postId)
          .then((aroundResult) => {
            if (get().focusRequestToken !== requestToken) {
              return;
            }

            set((state) => {
              applyTimelineWindow({
                bumpSession: true,
                state,
                timeline: createFocusedTimelineState({
                  aroundResult,
                  targetKind: "restore",
                }),
                variant: "focused",
              });
              issueScrollRequest(state, {
                kind: "restore",
                smooth: false,
                view: savedConversationView,
              });
            });
          })
          .catch(() => {
            if (get().focusRequestToken !== requestToken) {
              return;
            }

            set((state) => {
              showLiveTimeline({
                bumpSession: true,
                requestLatest: true,
                smooth: false,
                state,
              });
            });
          });

        return;
      }

      set((state) => {
        state.isBootstrapped = true;
        showLiveTimeline({
          bumpSession: true,
          requestLatest: true,
          smooth: false,
          state,
        });
      });
    },

    syncLiveWindow: ({ hasMoreBefore, posts }) => {
      set((state) => {
        state.liveHasMoreBefore = hasMoreBefore;
        state.liveLatestPostId = posts.at(-1)?._id ?? null;
        state.livePosts = posts;

        if (state.baselineLatestPostId === null && state.liveLatestPostId) {
          state.baselineLatestPostId = state.liveLatestPostId;
        }

        if (!state.isBootstrapped) {
          syncDerivedState(state);
          return;
        }

        if (state.variant === "live") {
          showLiveTimeline({
            bumpSession: state.timeline === null,
            requestLatest: state.pendingLatestScroll !== null,
            smooth: state.pendingLatestScroll?.smooth ?? false,
            state,
          });
          return;
        }

        if (state.timeline) {
          state.timeline = refreshFocusedTimeline({
            current: state.timeline,
            livePosts: posts,
          });
        }

        syncDerivedState(state);
      });
    },
  };
}
