import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ConversationRuntimeState } from "@/components/school/classes/forum/conversation/store/runtime/types";
import { clearBackStack } from "@/components/school/classes/forum/conversation/utils/back-stack";

/** Creates the initial transient runtime state for one forum conversation. */
export function createInitialRuntimeState({
  currentUserId,
  forumId,
  prefersReducedMotion,
}: {
  currentUserId: Id<"users">;
  forumId: Id<"schoolClassForums">;
  prefersReducedMotion: boolean;
}): ConversationRuntimeState {
  return {
    backStack: clearBackStack(),
    baselineLatestPostId: null,
    canGoBack: false,
    currentUserId,
    focusRequestToken: 0,
    forum: undefined,
    forumId,
    hasMoreAfter: false,
    hasMoreBefore: false,
    hasPendingLatestPosts: false,
    highlightedPostId: null,
    highlightTimeoutId: null,
    isAtBottom: false,
    isAtLatestEdge: false,
    isBootstrapped: false,
    isHydrated: false,
    isInitialLoading: true,
    isLoadingNewer: false,
    isLoadingOlder: false,
    isUnreadCueAcknowledged: false,
    items: [],
    lastPostId: undefined,
    liveHasMoreBefore: false,
    liveLatestPostId: null,
    livePosts: [],
    pendingHighlightPostId: null,
    pendingJumpProtectionPostId: null,
    pendingLatestScroll: null,
    postIdToIndex: new Map(),
    prefersReducedMotion,
    savedConversationView: null,
    scrollRequest: null,
    scrollRequestId: 0,
    settledConversationView: null,
    timeline: null,
    timelineSessionVersion: 0,
    transcriptVariant: "live",
    unreadPostId: null,
    variant: "booting",
  };
}
