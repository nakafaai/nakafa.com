import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
  FORUM_CONVERSATION_WINDOW,
} from "@/components/school/classes/forum/conversation/utils/focused";
import type { TimelineState } from "@/components/school/classes/forum/conversation/utils/session";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumPost } from "@/lib/store/forum";

/** Creates one live-edge timeline from the reactive latest page. */
function createLiveTimelineState(
  posts: ForumPost[],
  hasMoreBefore: boolean
): TimelineState {
  return {
    hasMoreAfter: false,
    hasMoreBefore,
    isAtLatestEdge: true,
    isJumpMode: false,
    newestPostId: posts.at(-1)?._id ?? null,
    oldestPostId: posts[0]?._id ?? null,
    posts,
  };
}

/** Replaces matching posts in one timeline with fresher copies from another list. */
function replaceMatchingPosts(current: ForumPost[], incoming: ForumPost[]) {
  if (incoming.length === 0 || current.length === 0) {
    return { changed: false, posts: current };
  }

  const incomingById = new Map(incoming.map((post) => [post._id, post]));
  let changed = false;
  const posts = current.map((post) => {
    const nextPost = incomingById.get(post._id);

    if (!nextPost || nextPost === post) {
      return post;
    }

    changed = true;
    return nextPost;
  });

  return { changed, posts };
}

/** Prepends older posts without duplicating ids already present in the window. */
function prependUniquePosts(current: ForumPost[], incoming: ForumPost[]) {
  const { changed, posts } = replaceMatchingPosts(current, incoming);
  const existingIds = new Set(posts.map((post) => post._id));
  const prepended = incoming.filter((post) => !existingIds.has(post._id));

  if (prepended.length === 0) {
    return { changed, posts };
  }

  return {
    changed: true,
    posts: [...prepended, ...posts],
  };
}

/** Appends newer posts without duplicating ids already present in the window. */
function appendUniquePosts(current: ForumPost[], incoming: ForumPost[]) {
  const { changed, posts } = replaceMatchingPosts(current, incoming);
  const existingIds = new Set(posts.map((post) => post._id));
  const appended = incoming.filter((post) => !existingIds.has(post._id));

  if (appended.length === 0) {
    return { changed, posts };
  }

  return {
    changed: true,
    posts: [...posts, ...appended],
  };
}

/** Syncs one focused timeline window with fresher reactive live posts. */
function syncFocusedTimelineWithLivePosts({
  current,
  liveHasMoreBefore,
  livePosts,
}: {
  current: TimelineState;
  liveHasMoreBefore: boolean;
  livePosts: ForumPost[];
}) {
  if (current.posts.length === 0) {
    if (!current.isAtLatestEdge) {
      return current;
    }

    return createLiveTimelineState(livePosts, liveHasMoreBefore);
  }

  const nextPosts = current.isAtLatestEdge
    ? appendUniquePosts(current.posts, livePosts)
    : replaceMatchingPosts(current.posts, livePosts);

  if (!nextPosts.changed) {
    return current;
  }

  return {
    ...current,
    hasMoreAfter: current.isAtLatestEdge ? false : current.hasMoreAfter,
    isJumpMode: current.isAtLatestEdge ? false : current.isJumpMode,
    newestPostId: nextPosts.posts.at(-1)?._id ?? null,
    oldestPostId: nextPosts.posts[0]?._id ?? null,
    posts: nextPosts.posts,
  };
}

/** Keeps one forum transcript aligned to either the reactive live feed or one focused window. */
export function useForumPosts({
  forumId,
  mode,
}: {
  forumId: Id<"schoolClassForums">;
  mode: ForumConversationMode;
}) {
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
    () => createLiveTimelineState(livePosts, liveHasMoreBefore),
    [liveHasMoreBefore, livePosts]
  );
  const [focusedTimeline, setFocusedTimeline] = useState<TimelineState | null>(
    null
  );
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

  /** Replaces the mounted transcript with one focused detached window. */
  const replaceWithFocusedTimeline = useCallback((timeline: TimelineState) => {
    setOlderRequestPostId(null);
    setNewerRequestPostId(null);
    setFocusedTimeline(timeline);
    setTimelineSessionVersion((current) => current + 1);
  }, []);

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

  /** Promotes the transcript back to the reactive live latest window. */
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
    isJumpMode: timeline?.isJumpMode ?? false,
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

export { useForumPosts as usePosts };
