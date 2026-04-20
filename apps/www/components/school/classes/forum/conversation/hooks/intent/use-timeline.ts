import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
  FORUM_CONVERSATION_WINDOW,
} from "@/components/school/classes/forum/conversation/utils/focused";
import { FORUM_MAX_BUFFERED_OLDER_PAGES } from "@/components/school/classes/forum/conversation/utils/scroll-policy";
import {
  appendUniquePosts,
  type ConversationTimeline,
  createLiveTimeline,
  createOlderPrefetchPages,
  getOlderPrefetchBoundaryPostId,
  type OlderPrefetchPage,
  prependUniquePosts,
  refreshFocusedTimeline,
  syncLiveRenderedPosts,
} from "@/components/school/classes/forum/conversation/utils/timeline";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumPost } from "@/lib/store/forum";

type OlderLoadResult = "committed" | "noop" | "prefetched";

interface UseConversationTimelineResult {
  canPrefetchOlderPosts: boolean;
  hasBufferedOlderPosts: boolean;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  hasPendingLatestPosts: boolean;
  isAtLatestEdge: boolean;
  isInitialLoading: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  loadNewerPosts: () => void;
  loadOlderPosts: () => OlderLoadResult;
  posts: ConversationTimeline["posts"];
  replaceWithFocusedTimeline: (timeline: ConversationTimeline) => void;
  showLatestPosts: () => boolean;
  timelineSessionVersion: number;
  transcriptVariant: "focused" | "live";
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
  const liveLatestPostId = livePosts.at(-1)?._id ?? null;
  const liveHasMoreBefore =
    liveStatus === "CanLoadMore" || liveStatus === "LoadingMore";
  const [renderedLivePosts, setRenderedLivePosts] =
    useState<ForumPost[]>(livePosts);
  const [focusedOlderPages, setFocusedOlderPages] = useState<
    OlderPrefetchPage[]
  >([]);
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
  const bufferedLiveOlderPages = useMemo(
    () =>
      createOlderPrefetchPages({
        fetchedPosts: livePosts,
        hasMoreBefore: liveHasMoreBefore,
        maxPages: FORUM_MAX_BUFFERED_OLDER_PAGES,
        pageSize: FORUM_CONVERSATION_WINDOW,
        renderedPosts: renderedLivePosts,
      }),
    [liveHasMoreBefore, livePosts, renderedLivePosts]
  );
  const liveTimeline = useMemo(
    () =>
      createLiveTimeline(
        renderedLivePosts,
        liveHasMoreBefore || bufferedLiveOlderPages.length > 0
      ),
    [bufferedLiveOlderPages.length, liveHasMoreBefore, renderedLivePosts]
  );

  useEffect(() => {
    if (liveStatus === "LoadingFirstPage") {
      return;
    }

    setRenderedLivePosts((currentPosts) => {
      const nextPosts =
        currentPosts.length === 0
          ? {
              changed: livePosts.length > 0,
              posts: livePosts,
            }
          : syncLiveRenderedPosts({
              current: currentPosts,
              incoming: livePosts,
            });

      return nextPosts.changed ? nextPosts.posts : currentPosts;
    });
  }, [livePosts, liveStatus]);

  const timeline = useMemo(() => {
    if (focusedTimeline) {
      return refreshFocusedTimeline({
        current: focusedTimeline,
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
    livePosts,
    liveStatus,
    liveTimeline,
    mode.kind,
    restoreFocusedWindow,
  ]);

  /** Replaces the mounted transcript with a focused detached window. */
  const replaceWithFocusedTimeline = useCallback(
    (nextTimeline: ConversationTimeline) => {
      setFocusedOlderPages([]);
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

    setFocusedOlderPages([]);
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

    setFocusedOlderPages((currentPages) => {
      const expectedBoundaryPostId = getOlderPrefetchBoundaryPostId({
        bufferedPages: currentPages,
        renderedPosts: focusedTimeline?.posts ?? timeline?.posts ?? [],
      });

      if (expectedBoundaryPostId !== olderRequestPostId) {
        return currentPages;
      }

      return [
        ...currentPages,
        {
          hasMoreBefore: olderData.hasMore,
          oldestPostId: olderData.oldestPostId,
          posts: olderData.posts,
        },
      ];
    });
    setOlderRequestPostId(null);
  }, [focusedTimeline?.posts, olderData, olderRequestPostId, timeline?.posts]);

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
  const loadOlderPosts = useCallback((): OlderLoadResult => {
    if (focusedTimeline === null) {
      const nextBufferedPage = bufferedLiveOlderPages[0];

      if (nextBufferedPage) {
        setRenderedLivePosts(
          (currentPosts) =>
            prependUniquePosts(currentPosts, nextBufferedPage.posts).posts
        );
        return "committed";
      }

      if (
        bufferedLiveOlderPages.length < FORUM_MAX_BUFFERED_OLDER_PAGES &&
        liveStatus === "CanLoadMore"
      ) {
        loadMore(FORUM_CONVERSATION_WINDOW);
        return "prefetched";
      }

      return "noop";
    }

    const nextBufferedPage = focusedOlderPages[0];

    if (nextBufferedPage) {
      setFocusedOlderPages((currentPages) => currentPages.slice(1));
      setFocusedTimeline((currentTimeline) => {
        const current = currentTimeline ?? timeline;

        if (!current) {
          return currentTimeline;
        }

        const nextPosts = prependUniquePosts(
          current.posts,
          nextBufferedPage.posts
        );

        return {
          ...current,
          hasMoreBefore:
            focusedOlderPages.length > 1 || nextBufferedPage.hasMoreBefore,
          oldestPostId: nextBufferedPage.oldestPostId ?? current.oldestPostId,
          posts: nextPosts.posts,
        };
      });
      return "committed";
    }

    if (
      olderRequestPostId !== null ||
      focusedOlderPages.length >= FORUM_MAX_BUFFERED_OLDER_PAGES ||
      !focusedTimeline.hasMoreBefore
    ) {
      return "noop";
    }

    const boundaryPostId = getOlderPrefetchBoundaryPostId({
      bufferedPages: focusedOlderPages,
      renderedPosts: focusedTimeline.posts,
    });

    if (!boundaryPostId) {
      return "noop";
    }

    setOlderRequestPostId(boundaryPostId);
    return "prefetched";
  }, [
    bufferedLiveOlderPages,
    focusedOlderPages,
    focusedTimeline,
    liveStatus,
    loadMore,
    olderRequestPostId,
    timeline,
  ]);

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

    setFocusedOlderPages([]);
    setOlderRequestPostId(null);
    setNewerRequestPostId(null);
    setRenderedLivePosts(livePosts);

    if (focusedTimeline !== null) {
      setFocusedTimeline(null);
      setTimelineSessionVersion((current) => current + 1);
    }

    return true;
  }, [focusedTimeline, livePosts, liveStatus]);

  const transcriptVariant =
    focusedTimeline === null && mode.kind === "live" ? "live" : "focused";
  const hasBufferedOlderPosts =
    focusedTimeline === null
      ? bufferedLiveOlderPages.length > 0
      : focusedOlderPages.length > 0;
  const canPrefetchOlderPosts =
    focusedTimeline === null
      ? bufferedLiveOlderPages.length < FORUM_MAX_BUFFERED_OLDER_PAGES &&
        liveStatus === "CanLoadMore"
      : olderRequestPostId === null &&
        focusedOlderPages.length < FORUM_MAX_BUFFERED_OLDER_PAGES &&
        (focusedTimeline?.hasMoreBefore ?? false);
  const hasPendingLatestPosts =
    transcriptVariant === "focused" &&
    timeline !== null &&
    liveLatestPostId !== null &&
    timeline.newestPostId !== liveLatestPostId;

  return {
    canPrefetchOlderPosts,
    hasBufferedOlderPosts,
    hasMoreAfter: timeline?.hasMoreAfter ?? false,
    hasMoreBefore: (timeline?.hasMoreBefore ?? false) || hasBufferedOlderPosts,
    hasPendingLatestPosts,
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
    transcriptVariant,
  };
}
