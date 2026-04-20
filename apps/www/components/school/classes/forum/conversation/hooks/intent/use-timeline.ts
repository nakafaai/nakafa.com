import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
  FORUM_CONVERSATION_WINDOW,
} from "@/components/school/classes/forum/conversation/utils/focused";
import {
  appendUniquePosts,
  type ConversationTimeline,
  createLiveTimeline,
  prependUniquePosts,
  syncFocusedTimelineWithLivePosts,
} from "@/components/school/classes/forum/conversation/utils/timeline";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";

interface UseConversationTimelineResult {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isAtLatestEdge: boolean;
  isInitialLoading: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  loadNewerPosts: () => void;
  loadOlderPosts: () => void;
  posts: ConversationTimeline["posts"];
  replaceWithFocusedTimeline: (timeline: ConversationTimeline) => void;
  showLatestPosts: () => boolean;
  timelineSessionVersion: number;
}

/** Keeps one forum transcript aligned to either the live feed or a focused timeline window. */
export function useConversationTimeline({
  forumId,
  mode,
}: {
  forumId: Id<"schoolClassForums">;
  mode: ForumConversationMode;
}): UseConversationTimelineResult {
  const {
    loadMore,
    results: liveResults,
    status: liveStatus,
  } = usePaginatedQuery(
    api.classes.forums.queries.feed.getForumPosts,
    { forumId },
    { initialNumItems: FORUM_CONVERSATION_WINDOW }
  );
  const livePosts = useMemo(() => [...liveResults].reverse(), [liveResults]);
  const liveHasMoreBefore =
    liveStatus === "CanLoadMore" || liveStatus === "LoadingMore";
  const liveTimeline = useMemo(
    () => createLiveTimeline(livePosts, liveHasMoreBefore),
    [liveHasMoreBefore, livePosts]
  );
  const [focusedTimeline, setFocusedTimeline] =
    useState<ConversationTimeline | null>(null);
  const [olderRequestPostId, setOlderRequestPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const [newerRequestPostId, setNewerRequestPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const [timelineSessionVersion, setTimelineSessionVersion] = useState(0);
  const shouldLoadRestoreFocusedWindow =
    mode.kind === "restore" && focusedTimeline === null;
  const restoreFocusedWindow = useQuery(
    api.classes.forums.queries.around.getForumPostsAround,
    shouldLoadRestoreFocusedWindow
      ? createFocusedWindowArgs({
          forumId,
          targetPostId: mode.postId,
        })
      : "skip"
  );
  const timeline = useMemo(() => {
    if (focusedTimeline) {
      return syncFocusedTimelineWithLivePosts({
        current: focusedTimeline,
        liveHasMoreBefore,
        livePosts,
      });
    }

    if (mode.kind === "restore") {
      if (restoreFocusedWindow === undefined) {
        return null;
      }

      return createFocusedTimelineState({
        aroundResult: restoreFocusedWindow,
        targetKind: "restore",
      });
    }

    if (liveStatus === "LoadingFirstPage") {
      return null;
    }

    return liveTimeline;
  }, [
    focusedTimeline,
    liveHasMoreBefore,
    livePosts,
    liveStatus,
    liveTimeline,
    mode.kind,
    restoreFocusedWindow,
  ]);

  /** Replaces the mounted transcript with a focused detached window. */
  const replaceWithFocusedTimeline = useCallback(
    (nextTimeline: ConversationTimeline) => {
      setOlderRequestPostId(null);
      setNewerRequestPostId(null);
      setFocusedTimeline(nextTimeline);
      setTimelineSessionVersion((current) => current + 1);
    },
    []
  );

  useEffect(() => {
    if (!(mode.kind === "restore" && focusedTimeline === null && timeline)) {
      return;
    }

    setFocusedTimeline(timeline);
  }, [focusedTimeline, mode.kind, timeline]);

  const olderData = useQuery(
    api.classes.forums.queries.older.getForumPostsOlder,
    olderRequestPostId
      ? {
          beforePostId: olderRequestPostId,
          forumId,
          limit: FORUM_CONVERSATION_WINDOW,
        }
      : "skip"
  );

  useEffect(() => {
    if (!(olderData && olderRequestPostId)) {
      return;
    }

    setFocusedTimeline((currentTimeline) => {
      const current = currentTimeline ?? timeline;

      if (!(current && current.oldestPostId === olderRequestPostId)) {
        return currentTimeline;
      }

      const nextPosts = prependUniquePosts(current.posts, olderData.posts);

      if (!nextPosts.changed) {
        return {
          ...current,
          hasMoreBefore: olderData.hasMore,
          oldestPostId: olderData.oldestPostId ?? current.oldestPostId,
        };
      }

      return {
        ...current,
        hasMoreBefore: olderData.hasMore,
        oldestPostId: olderData.oldestPostId ?? current.oldestPostId,
        posts: nextPosts.posts,
      };
    });
    setOlderRequestPostId(null);
  }, [olderData, olderRequestPostId, timeline]);

  const newerData = useQuery(
    api.classes.forums.queries.newer.getForumPostsNewer,
    newerRequestPostId
      ? {
          afterPostId: newerRequestPostId,
          forumId,
          limit: FORUM_CONVERSATION_WINDOW,
        }
      : "skip"
  );

  useEffect(() => {
    if (!(newerData && newerRequestPostId)) {
      return;
    }

    setFocusedTimeline((currentTimeline) => {
      const current = currentTimeline ?? timeline;

      if (!(current && current.newestPostId === newerRequestPostId)) {
        return currentTimeline;
      }

      const nextPosts = appendUniquePosts(current.posts, newerData.posts);
      const isAtLatestEdge = !newerData.hasMore;

      return {
        ...current,
        hasMoreAfter: newerData.hasMore,
        isAtLatestEdge,
        isJumpMode: isAtLatestEdge ? false : current.isJumpMode,
        newestPostId: newerData.newestPostId ?? current.newestPostId,
        posts: nextPosts.posts,
      };
    });
    setNewerRequestPostId(null);
  }, [newerData, newerRequestPostId, timeline]);

  /** Loads older history above the active transcript window. */
  const loadOlderPosts = useCallback(() => {
    if (focusedTimeline === null) {
      if (liveStatus === "CanLoadMore") {
        loadMore(FORUM_CONVERSATION_WINDOW);
      }

      return;
    }

    setOlderRequestPostId((currentRequestPostId) => {
      if (currentRequestPostId) {
        return currentRequestPostId;
      }

      if (!(focusedTimeline.hasMoreBefore && focusedTimeline.oldestPostId)) {
        return null;
      }

      return focusedTimeline.oldestPostId;
    });
  }, [focusedTimeline, liveStatus, loadMore]);

  /** Loads newer history below one focused transcript window. */
  const loadNewerPosts = useCallback(() => {
    if (!focusedTimeline) {
      return;
    }

    setNewerRequestPostId((currentRequestPostId) => {
      if (currentRequestPostId) {
        return currentRequestPostId;
      }

      if (!(focusedTimeline.hasMoreAfter && focusedTimeline.newestPostId)) {
        return null;
      }

      return focusedTimeline.newestPostId;
    });
  }, [focusedTimeline]);

  /** Promotes the transcript back to the reactive latest live window. */
  const showLatestPosts = useCallback(() => {
    if (liveStatus === "LoadingFirstPage") {
      return false;
    }

    setOlderRequestPostId(null);
    setNewerRequestPostId(null);

    if (focusedTimeline !== null) {
      setFocusedTimeline(null);
      setTimelineSessionVersion((current) => current + 1);
    }

    return true;
  }, [focusedTimeline, liveStatus]);

  return {
    hasMoreAfter: timeline?.hasMoreAfter ?? false,
    hasMoreBefore: timeline?.hasMoreBefore ?? false,
    isAtLatestEdge: timeline?.isAtLatestEdge ?? false,
    isInitialLoading: timeline === null,
    isLoadingNewer: newerRequestPostId !== null,
    isLoadingOlder:
      focusedTimeline === null
        ? liveStatus === "LoadingMore"
        : olderRequestPostId !== null,
    loadNewerPosts,
    loadOlderPosts,
    posts: timeline?.posts ?? [],
    replaceWithFocusedTimeline,
    showLatestPosts,
    timelineSessionVersion,
  };
}
