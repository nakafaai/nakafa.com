"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForum } from "@/lib/context/use-forum";
import type { ForumPost } from "@/lib/store/forum";

interface JumpPostsState {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isLoadingNewer: boolean;
  isLoadingOlder: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
  targetIndex: number;
  targetPostId: Id<"schoolClassForumPosts">;
}

/**
 * Build one empty jump-mode state around a target post.
 */
function createJumpPostsState(
  targetPostId: Id<"schoolClassForumPosts">
): JumpPostsState {
  return {
    hasMoreAfter: false,
    hasMoreBefore: false,
    isLoadingNewer: false,
    isLoadingOlder: false,
    newestPostId: null,
    oldestPostId: null,
    posts: [],
    targetIndex: 0,
    targetPostId,
  };
}

/**
 * Keep forum post pagination local to the conversation while the store only
 * tracks jump intent.
 */
export function useForumPosts(forumId: Id<"schoolClassForums">) {
  const jumpTargetPostId = useForum((state) => state.jumpTargetPostId);
  const exitJumpMode = useForum((state) => state.exitJumpMode);
  const [jumpState, setJumpState] = useState<JumpPostsState | null>(null);

  useEffect(() => {
    if (!jumpTargetPostId) {
      setJumpState((current) => (current ? null : current));
      return;
    }

    setJumpState((current) => {
      if (current?.targetPostId === jumpTargetPostId) {
        return current;
      }

      return createJumpPostsState(jumpTargetPostId);
    });
  }, [jumpTargetPostId]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.classes.forums.queries.feed.getForumPosts,
    jumpTargetPostId ? "skip" : { forumId },
    { initialNumItems: 25 }
  );

  const shouldFetchJumpData =
    jumpState !== null && jumpState.posts.length === 0;
  const jumpInitData = useQuery(
    api.classes.forums.queries.around.getForumPostsAround,
    shouldFetchJumpData
      ? { forumId, targetPostId: jumpState.targetPostId }
      : "skip"
  );

  useEffect(() => {
    if (!(jumpState && jumpInitData && jumpState.posts.length === 0)) {
      return;
    }

    setJumpState((current) => {
      if (!(current && current.targetPostId === jumpState.targetPostId)) {
        return current;
      }

      return {
        ...current,
        hasMoreAfter: jumpInitData.hasMoreAfter,
        hasMoreBefore: jumpInitData.hasMoreBefore,
        newestPostId: jumpInitData.newestPostId,
        oldestPostId: jumpInitData.oldestPostId,
        posts: jumpInitData.posts,
        targetIndex: jumpInitData.targetIndex,
      };
    });
  }, [jumpInitData, jumpState]);

  const olderData = useQuery(
    api.classes.forums.queries.older.getForumPostsOlder,
    jumpState?.isLoadingOlder && jumpState.oldestPostId
      ? { forumId, beforePostId: jumpState.oldestPostId }
      : "skip"
  );

  const newerData = useQuery(
    api.classes.forums.queries.newer.getForumPostsNewer,
    jumpState?.isLoadingNewer && jumpState.newestPostId
      ? { forumId, afterPostId: jumpState.newestPostId }
      : "skip"
  );

  useEffect(() => {
    if (!olderData) {
      return;
    }

    setJumpState((current) => {
      if (!current?.isLoadingOlder) {
        return current;
      }

      return {
        ...current,
        hasMoreBefore: olderData.hasMore,
        isLoadingOlder: false,
        oldestPostId: olderData.oldestPostId ?? current.oldestPostId,
        posts: [...olderData.posts, ...current.posts],
        targetIndex: current.targetIndex + olderData.posts.length,
      };
    });
  }, [olderData]);

  useEffect(() => {
    if (!newerData) {
      return;
    }

    setJumpState((current) => {
      if (!current?.isLoadingNewer) {
        return current;
      }

      return {
        ...current,
        hasMoreAfter: newerData.hasMore,
        isLoadingNewer: false,
        newestPostId: newerData.newestPostId ?? current.newestPostId,
        posts: [...current.posts, ...newerData.posts],
      };
    });
  }, [newerData]);

  const loadOlderPosts = useCallback(() => {
    setJumpState((current) => {
      if (!(current?.hasMoreBefore && !current.isLoadingOlder)) {
        return current;
      }

      return { ...current, isLoadingOlder: true };
    });
  }, []);

  const loadNewerPosts = useCallback(() => {
    setJumpState((current) => {
      if (!(current?.hasMoreAfter && !current.isLoadingNewer)) {
        return current;
      }

      return { ...current, isLoadingNewer: true };
    });
  }, []);

  const isJumpMode = jumpState !== null && jumpState.posts.length > 0;

  const posts = useMemo(() => {
    if (isJumpMode && jumpState) {
      return jumpState.posts;
    }

    return [...results].reverse();
  }, [isJumpMode, jumpState, results]);

  const hasMoreBefore = isJumpMode
    ? (jumpState?.hasMoreBefore ?? false)
    : status === "CanLoadMore" || status === "LoadingMore";

  const hasMoreAfter = isJumpMode ? (jumpState?.hasMoreAfter ?? false) : false;
  const isLoadingOlder = jumpState?.isLoadingOlder ?? false;
  const isLoadingNewer = jumpState?.isLoadingNewer ?? false;
  const targetIndex = jumpState?.targetIndex ?? 0;

  const isInitialLoading =
    (jumpTargetPostId !== null && jumpState?.posts.length === 0) ||
    (jumpTargetPostId === null &&
      status === "LoadingFirstPage" &&
      results.length === 0);

  return {
    exitJumpMode,
    hasMoreAfter,
    hasMoreBefore,
    isInitialLoading,
    isJumpMode,
    isLoadingNewer,
    isLoadingOlder,
    loadMore,
    loadNewerPosts,
    loadOlderPosts,
    posts,
    status,
    targetIndex,
  };
}
