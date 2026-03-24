"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
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
    api.classes.forums.queries.feed.getForumPosts,
    jumpMode ? "skip" : { forumId },
    { initialNumItems: 25 }
  );

  // Initial jump data fetch
  const shouldFetchJumpData = jumpMode !== null && jumpMode.posts.length === 0;
  const jumpInitData = useQuery(
    api.classes.forums.queries.around.getForumPostsAround,
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
        oldestPostId: jumpInitData.oldestPostId,
        newestPostId: jumpInitData.newestPostId,
      });
    }
  }, [shouldFetchJumpData, jumpInitData, setJumpModeData]);

  // Bidirectional pagination queries
  const olderData = useQuery(
    api.classes.forums.queries.older.getForumPostsOlder,
    jumpMode?.isLoadingOlder === true && jumpMode.oldestPostId
      ? { forumId, beforePostId: jumpMode.oldestPostId }
      : "skip"
  );

  const newerData = useQuery(
    api.classes.forums.queries.newer.getForumPostsNewer,
    jumpMode?.isLoadingNewer === true && jumpMode.newestPostId
      ? { forumId, afterPostId: jumpMode.newestPostId }
      : "skip"
  );

  // Merge older posts when loaded
  useEffect(() => {
    if (jumpMode?.isLoadingOlder === true && olderData) {
      appendOlderPosts(
        olderData.posts,
        olderData.hasMore,
        olderData.oldestPostId
      );
    }
  }, [jumpMode?.isLoadingOlder, olderData, appendOlderPosts]);

  // Merge newer posts when loaded
  useEffect(() => {
    if (jumpMode?.isLoadingNewer === true && newerData) {
      appendNewerPosts(
        newerData.posts,
        newerData.hasMore,
        newerData.newestPostId
      );
    }
  }, [jumpMode?.isLoadingNewer, newerData, appendNewerPosts]);

  // Determine which posts to show
  const isJumpMode = jumpMode !== null && jumpMode.posts.length > 0;

  const posts = useMemo(() => {
    if (isJumpMode) {
      return jumpMode.posts;
    }

    return [...results].reverse();
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
