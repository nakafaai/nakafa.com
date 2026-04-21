import { syncDerivedState } from "@/components/school/classes/forum/conversation/store/runtime/derived";
import type {
  ConversationRuntimeActions,
  RuntimeActionContext,
} from "@/components/school/classes/forum/conversation/store/runtime/types";
import {
  appendUniquePosts,
  prependUniquePosts,
} from "@/components/school/classes/forum/conversation/utils/timeline";

/** Creates the timeline paging actions for one conversation runtime store. */
export function createPagingActions({
  get,
  getDeps,
  set,
}: RuntimeActionContext): Pick<
  ConversationRuntimeActions,
  "loadNewerPosts" | "loadOlderPosts"
> {
  return {
    loadNewerPosts: () => {
      const currentState = get();

      if (
        !(
          currentState.variant === "focused" &&
          currentState.timeline?.hasMoreAfter &&
          currentState.timeline.newestPostId &&
          !currentState.isLoadingNewer
        )
      ) {
        return false;
      }

      set((state) => {
        state.isLoadingNewer = true;
      });

      getDeps()
        .fetchNewer(currentState.timeline.newestPostId)
        .then((newerResult) => {
          set((state) => {
            if (!(state.variant === "focused" && state.timeline)) {
              state.isLoadingNewer = false;
              return;
            }

            const nextPosts = appendUniquePosts(
              state.timeline.posts,
              newerResult.posts
            );

            state.timeline = {
              ...state.timeline,
              hasMoreAfter: newerResult.hasMore,
              isAtLatestEdge: !newerResult.hasMore,
              isJumpMode: newerResult.hasMore
                ? state.timeline.isJumpMode
                : false,
              newestPostId:
                newerResult.newestPostId ?? state.timeline.newestPostId,
              posts: nextPosts.posts,
            };
            state.isLoadingNewer = false;
            syncDerivedState(state);
          });
        })
        .catch(() => {
          set((state) => {
            state.isLoadingNewer = false;
          });
        });

      return true;
    },

    loadOlderPosts: () => {
      const currentState = get();

      if (
        !(currentState.timeline?.hasMoreBefore && !currentState.isLoadingOlder)
      ) {
        return false;
      }

      if (currentState.variant === "live") {
        getDeps().loadLiveOlder();
        return true;
      }

      if (!currentState.timeline.oldestPostId) {
        return false;
      }

      set((state) => {
        state.isLoadingOlder = true;
      });

      getDeps()
        .fetchOlder(currentState.timeline.oldestPostId)
        .then((olderResult) => {
          set((state) => {
            if (!(state.variant === "focused" && state.timeline)) {
              state.isLoadingOlder = false;
              return;
            }

            const nextPosts = prependUniquePosts(
              state.timeline.posts,
              olderResult.posts
            );

            state.timeline = {
              ...state.timeline,
              hasMoreBefore: olderResult.hasMore,
              oldestPostId:
                olderResult.oldestPostId ?? state.timeline.oldestPostId,
              posts: nextPosts.posts,
            };
            state.isLoadingOlder = false;
            syncDerivedState(state);
          });
        })
        .catch(() => {
          set((state) => {
            state.isLoadingOlder = false;
          });
        });

      return true;
    },
  };
}
