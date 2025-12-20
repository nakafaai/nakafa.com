"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo, useRef } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/types";
import { useForum } from "@/lib/context/use-forum";

/**
 * Handles all forum posts data fetching:
 * - Normal pagination (newest first, reversed for display)
 * - Jump mode (bidirectional pagination around target post)
 * - Older/newer posts loading in jump mode
 */
export function useForumPosts(forumId: Id<"schoolClassForums">) {
  // Jump mode state from store
  const jumpMode = useForum((s) => s.jumpMode);
  const setJumpModeData = useForum((s) => s.setJumpModeData);
  const appendOlderPosts = useForum((s) => s.appendOlderPosts);
  const appendNewerPosts = useForum((s) => s.appendNewerPosts);
  const exitJumpMode = useForum((s) => s.exitJumpMode);
  const loadOlderPosts = useForum((s) => s.loadOlderPosts);
  const loadNewerPosts = useForum((s) => s.loadNewerPosts);

  // Normal pagination mode
  const { results, status, loadMore } = usePaginatedQuery(
    api.classes.forums.queries.getForumPosts,
    jumpMode ? "skip" : { forumId },
    { initialNumItems: 25 }
  );

  // Initial jump data fetch
  const shouldFetchJumpData = jumpMode !== null && jumpMode.posts.length === 0;
  const jumpInitData = useQuery(
    api.classes.forums.queries.getForumPostsAround,
    shouldFetchJumpData
      ? { forumId, targetPostId: jumpMode.targetPostId }
      : "skip"
  );

  // Initialize jump mode when data arrives
  useEffect(() => {
    if (shouldFetchJumpData && jumpInitData) {
      setJumpModeData({
        posts: jumpInitData.posts,
        targetIndex: jumpInitData.targetIndex,
        hasMoreBefore: jumpInitData.hasMoreBefore,
        hasMoreAfter: jumpInitData.hasMoreAfter,
        oldestTime: jumpInitData.oldestTime,
        newestTime: jumpInitData.newestTime,
      });
    }
  }, [shouldFetchJumpData, jumpInitData, setJumpModeData]);

  // Bidirectional pagination queries
  const olderData = useQuery(
    api.classes.forums.queries.getForumPostsOlder,
    jumpMode?.isLoadingOlder === true
      ? { forumId, beforeTime: jumpMode.oldestTime }
      : "skip"
  );

  const newerData = useQuery(
    api.classes.forums.queries.getForumPostsNewer,
    jumpMode?.isLoadingNewer === true
      ? { forumId, afterTime: jumpMode.newestTime }
      : "skip"
  );

  // Merge older posts when loaded
  useEffect(() => {
    if (jumpMode?.isLoadingOlder === true && olderData) {
      appendOlderPosts(
        olderData.posts,
        olderData.hasMore,
        olderData.oldestTime
      );
    }
  }, [jumpMode?.isLoadingOlder, olderData, appendOlderPosts]);

  // Merge newer posts when loaded
  useEffect(() => {
    if (jumpMode?.isLoadingNewer === true && newerData) {
      appendNewerPosts(
        newerData.posts,
        newerData.hasMore,
        newerData.newestTime
      );
    }
  }, [jumpMode?.isLoadingNewer, newerData, appendNewerPosts]);

  // Determine which posts to show
  const isJumpMode = jumpMode !== null && jumpMode.posts.length > 0;
  const lastPostsRef = useRef<ForumPost[]>([]);

  const posts = useMemo(() => {
    let newPosts: ForumPost[];
    if (isJumpMode) {
      newPosts = jumpMode.posts;
    } else if (results.length > 0) {
      newPosts = [...results].reverse();
    } else {
      return lastPostsRef.current;
    }
    lastPostsRef.current = newPosts;
    return newPosts;
  }, [isJumpMode, jumpMode?.posts, results]);

  const hasMoreBefore = isJumpMode
    ? jumpMode.hasMoreBefore
    : status === "CanLoadMore" || status === "LoadingMore";

  const hasMoreAfter = isJumpMode ? jumpMode.hasMoreAfter : false;
  const isLoadingOlder = jumpMode?.isLoadingOlder ?? false;
  const isLoadingNewer = jumpMode?.isLoadingNewer ?? false;
  const targetIndex = jumpMode?.targetIndex ?? 0;

  const isInitialLoading =
    (jumpMode !== null && jumpMode.posts.length === 0) ||
    (jumpMode === null &&
      status === "LoadingFirstPage" &&
      results.length === 0);

  return {
    posts,
    isJumpMode,
    targetIndex,
    hasMoreBefore,
    hasMoreAfter,
    isLoadingOlder,
    isLoadingNewer,
    isInitialLoading,
    status,
    loadMore,
    loadOlderPosts,
    loadNewerPosts,
    exitJumpMode,
  };
}
