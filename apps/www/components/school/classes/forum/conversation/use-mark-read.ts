"use client";

import { useDebouncedCallback } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

/**
 * Discord/Slack-style mark-read strategy:
 * - Scroll to bottom → debounced 1s
 * - New messages while at bottom → immediate flush
 * - Scroll away from bottom → cancel pending mark-read
 * - Unmount → automatic flush via flushOnUnmount
 */
export function useMarkRead({
  forumId,
  lastPostId,
  isAtBottom,
  isJumpMode,
}: {
  forumId: Id<"schoolClassForums">;
  lastPostId: Id<"schoolClassForumPosts"> | undefined;
  isAtBottom: boolean;
  isJumpMode: boolean;
}) {
  const markRead = useMutation(api.classes.forums.mutations.markForumRead);
  const lastReadPostIdRef = useRef(lastPostId);

  lastReadPostIdRef.current = lastPostId;

  // Track if we've already marked read at bottom to prevent duplicate calls
  const hasMarkedAtBottomRef = useRef(false);

  const debouncedMarkRead = useDebouncedCallback(
    () => {
      const lastReadPostId = lastReadPostIdRef.current;

      if (lastReadPostId === undefined) {
        return;
      }

      return markRead({ forumId, lastReadPostId });
    },
    {
      delay: 1000,
      flushOnUnmount: true,
    }
  );

  // Cancel pending mark-read and reset flag when user scrolls away from bottom
  useEffect(() => {
    if (!isAtBottom) {
      debouncedMarkRead.cancel();
      hasMarkedAtBottomRef.current = false;
    }
  }, [isAtBottom, debouncedMarkRead]);

  // Primary trigger: mark read when user scrolls to bottom (debounced)
  const canMarkRead = isAtBottom && !isJumpMode;
  useEffect(() => {
    if (canMarkRead && !hasMarkedAtBottomRef.current) {
      hasMarkedAtBottomRef.current = true;
      debouncedMarkRead();
    }
  }, [canMarkRead, debouncedMarkRead]);

  // Real-time trigger: mark read when a newer visible post arrives.
  const prevLastPostIdRef = useRef(lastPostId);
  useEffect(() => {
    const prevPostId = prevLastPostIdRef.current;
    prevLastPostIdRef.current = lastPostId;

    const hasNewerPost =
      lastPostId !== undefined &&
      prevPostId !== undefined &&
      lastPostId !== prevPostId;

    if (hasNewerPost && isAtBottom && !isJumpMode) {
      debouncedMarkRead();
      debouncedMarkRead.flush();
    }
  }, [lastPostId, isAtBottom, isJumpMode, debouncedMarkRead]);
}
