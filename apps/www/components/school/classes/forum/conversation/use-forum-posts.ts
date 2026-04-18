"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createInitialTimelineSessionState,
  replaceTimelineSession,
  type TimelineState,
  updateTimelineWithinSession,
} from "@/components/school/classes/forum/conversation/timeline-session";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/view-state";
import type { ForumPost } from "@/lib/store/forum";

/** Keep restore, jump, and detached browsing windows aligned with the live feed size. */
const FORUM_CONVERSATION_WINDOW = 25;

interface TargetRequest {
  kind: Exclude<ForumConversationMode["kind"], "live">;
  postId: Id<"schoolClassForumPosts"> | null;
}

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

/** Creates one detached timeline window around a restored or jumped post. */
function createFocusedTimelineState({
  hasMoreAfter,
  hasMoreBefore,
  newestPostId,
  oldestPostId,
  posts,
  targetKind,
}: {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
  targetKind: TargetRequest["kind"];
}): TimelineState {
  const isAtLatestEdge = !hasMoreAfter;

  return {
    hasMoreAfter,
    hasMoreBefore,
    isAtLatestEdge,
    isJumpMode: targetKind === "jump" && !isAtLatestEdge,
    newestPostId,
    oldestPostId,
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

/**
 * Syncs the detached or connected timeline with the reactive latest page while
 * preserving already loaded history and avoiding hard source swaps.
 */
function syncTimelineWithLivePosts({
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

/**
 * Keeps one client-side transcript session synchronized with live/jump/restore
 * data, remounting only when the semantic transcript source itself changes.
 */
export function useForumPosts({
  forumId,
  mode,
}: {
  forumId: Id<"schoolClassForums">;
  mode: ForumConversationMode;
}) {
  const { results: liveResults, status: liveStatus } = usePaginatedQuery(
    api.classes.forums.queries.feed.getForumPosts,
    { forumId },
    { initialNumItems: FORUM_CONVERSATION_WINDOW }
  );
  const livePosts = useMemo(() => [...liveResults].reverse(), [liveResults]);
  const liveHasMoreBefore =
    liveStatus === "CanLoadMore" || liveStatus === "LoadingMore";

  const [timelineSession, setTimelineSession] = useState(
    createInitialTimelineSessionState
  );
  const [targetRequest, setTargetRequest] = useState<TargetRequest | null>(
    mode.kind === "live" ? null : { kind: mode.kind, postId: mode.postId }
  );
  const [shouldPromoteToLatest, setShouldPromoteToLatest] = useState(false);
  const [olderRequestPostId, setOlderRequestPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const [newerRequestPostId, setNewerRequestPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);

  const timeline = timelineSession.timeline;

  useEffect(() => {
    if (mode.kind === "live") {
      return;
    }

    setTargetRequest((current) => {
      if (current?.kind === mode.kind && current.postId === mode.postId) {
        return current;
      }

      return { kind: mode.kind, postId: mode.postId };
    });
  }, [mode]);

  useEffect(() => {
    setTimelineSession((current) => {
      if (current.timeline === null) {
        if (mode.kind !== "live" || liveStatus === "LoadingFirstPage") {
          return current;
        }

        return updateTimelineWithinSession(current, () =>
          createLiveTimelineState(livePosts, liveHasMoreBefore)
        );
      }

      return updateTimelineWithinSession(current, (timeline) => {
        if (!timeline) {
          return timeline;
        }

        return syncTimelineWithLivePosts({
          current: timeline,
          liveHasMoreBefore,
          livePosts,
        });
      });
    });
  }, [liveHasMoreBefore, livePosts, liveStatus, mode.kind]);

  useEffect(() => {
    if (!(shouldPromoteToLatest && liveStatus !== "LoadingFirstPage")) {
      return;
    }

    setTimelineSession((current) => {
      if (current.timeline?.isAtLatestEdge) {
        return updateTimelineWithinSession(current, (timeline) => {
          if (!timeline) {
            return timeline;
          }

          return syncTimelineWithLivePosts({
            current: { ...timeline, hasMoreAfter: false, isJumpMode: false },
            liveHasMoreBefore,
            livePosts,
          });
        });
      }

      return replaceTimelineSession(
        current,
        createLiveTimelineState(livePosts, liveHasMoreBefore)
      );
    });
    setShouldPromoteToLatest(false);
  }, [shouldPromoteToLatest, liveHasMoreBefore, livePosts, liveStatus]);

  const focusedInitData = useQuery(
    api.classes.forums.queries.around.getForumPostsAround,
    targetRequest?.postId
      ? {
          forumId,
          limit: FORUM_CONVERSATION_WINDOW,
          targetPostId: targetRequest.postId,
        }
      : "skip"
  );

  useEffect(() => {
    if (
      !(
        targetRequest &&
        !targetRequest.postId &&
        liveStatus !== "LoadingFirstPage"
      )
    ) {
      return;
    }

    setTimelineSession((current) =>
      replaceTimelineSession(
        current,
        createLiveTimelineState(livePosts, liveHasMoreBefore)
      )
    );
    setTargetRequest(null);
  }, [targetRequest, liveHasMoreBefore, livePosts, liveStatus]);

  useEffect(() => {
    if (!(focusedInitData && targetRequest?.postId)) {
      return;
    }

    setTimelineSession((current) =>
      replaceTimelineSession(
        current,
        createFocusedTimelineState({
          hasMoreAfter: focusedInitData.hasMoreAfter,
          hasMoreBefore: focusedInitData.hasMoreBefore,
          newestPostId: focusedInitData.newestPostId,
          oldestPostId: focusedInitData.oldestPostId,
          posts: focusedInitData.posts,
          targetKind: targetRequest.kind,
        })
      )
    );
    setOlderRequestPostId(null);
    setNewerRequestPostId(null);
    setTargetRequest(null);
  }, [focusedInitData, targetRequest]);

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

    setTimelineSession((current) =>
      updateTimelineWithinSession(current, (timeline) => {
        if (!(timeline && timeline.oldestPostId === olderRequestPostId)) {
          return timeline;
        }

        const nextPosts = prependUniquePosts(timeline.posts, olderData.posts);

        if (!nextPosts.changed) {
          return {
            ...timeline,
            hasMoreBefore: olderData.hasMore,
            oldestPostId: olderData.oldestPostId ?? timeline.oldestPostId,
          };
        }

        return {
          ...timeline,
          hasMoreBefore: olderData.hasMore,
          oldestPostId: olderData.oldestPostId ?? timeline.oldestPostId,
          posts: nextPosts.posts,
        };
      })
    );
    setOlderRequestPostId(null);
  }, [olderData, olderRequestPostId]);

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

    setTimelineSession((current) =>
      updateTimelineWithinSession(current, (timeline) => {
        if (!(timeline && timeline.newestPostId === newerRequestPostId)) {
          return timeline;
        }

        const nextPosts = appendUniquePosts(timeline.posts, newerData.posts);
        const isAtLatestEdge = !newerData.hasMore;

        return {
          ...timeline,
          hasMoreAfter: newerData.hasMore,
          isAtLatestEdge,
          isJumpMode: isAtLatestEdge ? false : timeline.isJumpMode,
          newestPostId: newerData.newestPostId ?? timeline.newestPostId,
          posts: nextPosts.posts,
        };
      })
    );
    setNewerRequestPostId(null);
  }, [newerData, newerRequestPostId]);

  /** Loads older history above the current transcript window. */
  const loadOlderPosts = useCallback(() => {
    setOlderRequestPostId((currentRequestPostId) => {
      if (currentRequestPostId) {
        return currentRequestPostId;
      }

      if (!(timeline?.hasMoreBefore && timeline.oldestPostId)) {
        return null;
      }

      return timeline.oldestPostId;
    });
  }, [timeline]);

  /** Loads newer history below the current transcript window. */
  const loadNewerPosts = useCallback(() => {
    setNewerRequestPostId((currentRequestPostId) => {
      if (currentRequestPostId) {
        return currentRequestPostId;
      }

      if (!(timeline?.hasMoreAfter && timeline.newestPostId)) {
        return null;
      }

      return timeline.newestPostId;
    });
  }, [timeline]);

  /** Promotes the transcript back to the reactive live latest window. */
  const showLatestPosts = useCallback(() => {
    if (liveStatus === "LoadingFirstPage") {
      setShouldPromoteToLatest(true);
      return false;
    }

    setShouldPromoteToLatest(false);
    setOlderRequestPostId(null);
    setNewerRequestPostId(null);
    setTargetRequest(null);
    setTimelineSession((current) => {
      if (current.timeline?.isAtLatestEdge) {
        return updateTimelineWithinSession(current, (timeline) => {
          if (!timeline) {
            return timeline;
          }

          return syncTimelineWithLivePosts({
            current: { ...timeline, hasMoreAfter: false, isJumpMode: false },
            liveHasMoreBefore,
            livePosts,
          });
        });
      }

      return replaceTimelineSession(
        current,
        createLiveTimelineState(livePosts, liveHasMoreBefore)
      );
    });

    return true;
  }, [liveHasMoreBefore, livePosts, liveStatus]);

  const isInitialLoading =
    timeline === null &&
    (mode.kind === "live" ? liveStatus === "LoadingFirstPage" : true);

  return {
    hasMoreAfter: timeline?.hasMoreAfter ?? false,
    hasMoreBefore: timeline?.hasMoreBefore ?? false,
    isAtLatestEdge: timeline?.isAtLatestEdge ?? false,
    isInitialLoading,
    isJumpMode: timeline?.isJumpMode ?? false,
    isLoadingNewer: newerRequestPostId !== null,
    isLoadingOlder: olderRequestPostId !== null,
    loadNewerPosts,
    loadOlderPosts,
    posts: timeline?.posts ?? [],
    showLatestPosts,
    timelineSessionVersion: timelineSession.sessionVersion,
  };
}
