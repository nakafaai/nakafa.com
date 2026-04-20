import { useReducedMotion } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useRef, useState } from "react";
import { useItems } from "@/components/school/classes/forum/conversation/hooks/data/use-items";
import { useRead } from "@/components/school/classes/forum/conversation/hooks/data/use-read";
import { useUnread } from "@/components/school/classes/forum/conversation/hooks/data/use-unread";
import { useConversationNavigation } from "@/components/school/classes/forum/conversation/hooks/intent/use-navigation";
import { useConversationTimeline } from "@/components/school/classes/forum/conversation/hooks/intent/use-timeline";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import {
  createForumConversationMode,
  type ForumConversationMode,
} from "@/components/school/classes/forum/conversation/utils/view";
import { useForum } from "@/lib/context/use-forum";

/** Owns the high-level forum conversation model without owning DOM or virtualizer state. */
export function useConversationModel({
  forum,
  forumId,
}: {
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
}) {
  const prefersReducedMotion = useReducedMotion();
  const saveConversationView = useForum((state) => state.saveConversationView);
  const savedConversationView = useForum(
    (state) => state.savedConversationViews[forumId] ?? null
  );
  const [mode, setMode] = useState<ForumConversationMode>(() =>
    createForumConversationMode({
      restoreView: savedConversationView,
    })
  );
  const [isAtBottom, setIsAtBottom] = useState(false);
  const baselineLatestPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
    null
  );
  const {
    canPrefetchOlderPosts,
    hasBufferedOlderPosts,
    hasMoreAfter,
    hasMoreBefore,
    hasPendingLatestPosts,
    isAtLatestEdge,
    isInitialLoading,
    isLoadingNewer,
    isLoadingOlder,
    loadNewerPosts,
    loadOlderPosts,
    posts,
    replaceWithFocusedTimeline,
    showLatestPosts,
    transcriptVariant,
    timelineSessionVersion,
  } = useConversationTimeline({
    forumId,
    mode,
  });

  if (
    baselineLatestPostIdRef.current === null &&
    isAtLatestEdge &&
    posts.length > 0
  ) {
    baselineLatestPostIdRef.current = posts.at(-1)?._id ?? null;
  }

  const { acknowledgeUnreadCue, unreadCue } = useUnread({
    baselineLatestPostId: baselineLatestPostIdRef.current,
    isDetachedMode: !isAtLatestEdge,
    isInitialLoading,
    posts,
  });
  const { items, postIdToIndex } = useItems({
    forum,
    isDetachedMode: !isAtLatestEdge,
    posts,
    unreadCue,
  });
  const { cancelPendingMarkRead, flushMarkRead, scheduleMarkRead } = useRead({
    forumId,
  });
  const {
    canGoBack,
    command,
    goBack,
    handleCommandResult,
    handleHighlightVisiblePost,
    handleSettledView,
    highlightedPostId,
    jumpToPostId,
    latestConversationView,
    pendingHighlightPostId,
    scrollToLatest,
  } = useConversationNavigation({
    forumId,
    isAtLatestEdge,
    postIdToIndex,
    replaceWithFocusedTimeline,
    saveConversationView,
    savedConversationView,
    setMode,
    shouldAnimateNavigation: !prefersReducedMotion,
    showLatestPosts,
    transcriptVariant,
  });
  const lastPostId = posts.at(-1)?._id;

  return {
    acknowledgeUnreadCue,
    canPrefetchOlderPosts,
    canGoBack,
    cancelPendingMarkRead,
    command,
    flushMarkRead,
    goBack,
    handleBottomStateChange: setIsAtBottom,
    handleCommandResult,
    handleHighlightVisiblePost,
    handleSettledView,
    hasBufferedOlderPosts,
    hasMoreAfter,
    hasMoreBefore,
    hasPendingLatestPosts,
    highlightedPostId,
    isAtBottom,
    isAtLatestEdge,
    isInitialLoading,
    isLoadingNewer,
    isLoadingOlder,
    items,
    jumpToPostId,
    lastPostId,
    latestConversationView,
    loadNewerPosts,
    loadOlderPosts,
    mode,
    pendingHighlightPostId,
    postIdToIndex,
    scheduleMarkRead,
    scrollToLatest,
    transcriptVariant,
    timelineSessionVersion,
    unreadPostId: unreadCue?.postId ?? null,
  };
}
