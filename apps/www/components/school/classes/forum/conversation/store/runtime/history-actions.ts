import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import {
  issueScrollRequest,
  syncDerivedState,
} from "@/components/school/classes/forum/conversation/store/runtime/derived";
import {
  clearHighlightState,
  maybePushCurrentViewToBackStack,
  pruneReachedBackHistory,
} from "@/components/school/classes/forum/conversation/store/runtime/navigation";
import {
  applyTimelineWindow,
  showLatestFromCurrentState,
  showLiveTimeline,
} from "@/components/school/classes/forum/conversation/store/runtime/timeline";
import type {
  ConversationRuntimeActions,
  RuntimeActionContext,
} from "@/components/school/classes/forum/conversation/store/runtime/types";
import { popBackView } from "@/components/school/classes/forum/conversation/utils/back-stack";
import { createFocusedTimelineState } from "@/components/school/classes/forum/conversation/utils/focused";

const FORUM_JUMP_HIGHLIGHT_DURATION = 1600;

/** Creates the navigation and history actions for one conversation runtime store. */
export function createHistoryActions({
  get,
  getDeps,
  set,
}: RuntimeActionContext): Pick<
  ConversationRuntimeActions,
  | "goBack"
  | "handleHighlightVisiblePost"
  | "handleSettledView"
  | "jumpToPostId"
  | "scrollToLatest"
> {
  return {
    goBack: () => {
      const { backStack, entry } = popBackView(get().backStack);

      if (!entry) {
        return;
      }

      const originView = entry.originView;

      set((state) => {
        state.backStack = backStack;
        clearHighlightState(state);
        syncDerivedState(state);
      });

      if (originView.kind === "bottom") {
        get().scrollToLatest();
        return;
      }

      const currentIndex = get().postIdToIndex.get(originView.postId);

      if (currentIndex !== undefined) {
        set((state) => {
          issueScrollRequest(state, {
            kind: "restore",
            smooth: false,
            view: originView,
          });
        });
        return;
      }

      const requestToken = get().focusRequestToken + 1;

      set((state) => {
        state.focusRequestToken = requestToken;
      });

      getDeps()
        .fetchAround(originView.postId)
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
              view: originView,
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
              requestLatest: false,
              smooth: false,
              state,
            });
          });
        });
    },

    handleHighlightVisiblePost: (postId) => {
      set((state) => {
        if (state.pendingHighlightPostId !== postId) {
          return;
        }

        if (state.highlightTimeoutId !== null) {
          window.clearTimeout(state.highlightTimeoutId);
        }

        state.pendingHighlightPostId = null;
        state.pendingJumpProtectionPostId =
          state.pendingJumpProtectionPostId === postId
            ? null
            : state.pendingJumpProtectionPostId;
        state.highlightedPostId = postId;
        state.highlightTimeoutId = window.setTimeout(() => {
          set((nextState) => {
            if (nextState.highlightedPostId !== postId) {
              return;
            }

            nextState.highlightTimeoutId = null;
            nextState.highlightedPostId = null;
          });
        }, FORUM_JUMP_HIGHLIGHT_DURATION);
      });
    },

    handleSettledView: (view) => {
      let shouldPersistSettledView = false;

      set((state) => {
        state.settledConversationView = view;

        if (state.pendingJumpProtectionPostId !== null) {
          syncDerivedState(state);
          return;
        }

        pruneReachedBackHistory(state);
        syncDerivedState(state);
        shouldPersistSettledView = true;
      });

      if (!shouldPersistSettledView) {
        return;
      }

      getDeps().saveConversationView(view);
    },

    jumpToPostId: (postId) => {
      const targetView = {
        kind: "post",
        offset: 0,
        postId,
      } satisfies ForumConversationView;
      const currentIndex = get().postIdToIndex.get(postId);

      set((state) => {
        clearHighlightState(state);
        state.pendingHighlightPostId = postId;
        state.pendingJumpProtectionPostId = postId;
        maybePushCurrentViewToBackStack(state, targetView);
        syncDerivedState(state);
      });

      if (currentIndex !== undefined) {
        set((state) => {
          issueScrollRequest(state, {
            kind: "jump",
            postId,
            smooth: !state.prefersReducedMotion,
          });
        });
        return;
      }

      const requestToken = get().focusRequestToken + 1;

      set((state) => {
        state.focusRequestToken = requestToken;
      });

      getDeps()
        .fetchAround(postId)
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
                targetKind: "jump",
              }),
              variant: "focused",
            });
            issueScrollRequest(state, {
              kind: "jump",
              postId,
              smooth: !state.prefersReducedMotion,
            });
          });
        })
        .catch(() => {
          if (get().focusRequestToken !== requestToken) {
            return;
          }

          set((state) => {
            clearHighlightState(state);
            showLiveTimeline({
              bumpSession: true,
              requestLatest: false,
              smooth: false,
              state,
            });
          });
        });
    },

    scrollToLatest: () => {
      set((state) => {
        showLatestFromCurrentState(state);
      });
    },
  };
}
