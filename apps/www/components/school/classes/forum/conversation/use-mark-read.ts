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
 * - Unmount → automatic flush via flushOnUnmount
 */
export function useMarkRead({
  forumId,
  postsLength,
  isAtBottom,
  isJumpMode,
}: {
  forumId: Id<"schoolClassForums">;
  postsLength: number;
  isAtBottom: boolean;
  isJumpMode: boolean;
}) {
  const markRead = useMutation(api.classes.mutations.markForumRead);

  // Store forumId in ref to avoid stale closure issues
  const forumIdRef = useRef(forumId);
  forumIdRef.current = forumId;

  // Track if we've already marked read at bottom to prevent duplicate calls
  const hasMarkedAtBottomRef = useRef(false);

  const debouncedMarkRead = useDebouncedCallback(
    () => markRead({ forumId: forumIdRef.current }),
    { delay: 1000, flushOnUnmount: true }
  );

  // Reset flag when user scrolls away from bottom
  useEffect(() => {
    if (!isAtBottom) {
      hasMarkedAtBottomRef.current = false;
    }
  }, [isAtBottom]);

  // Primary trigger: mark read when user scrolls to bottom (debounced)
  const canMarkRead = isAtBottom && !isJumpMode;
  useEffect(() => {
    if (canMarkRead && !hasMarkedAtBottomRef.current) {
      hasMarkedAtBottomRef.current = true;
      debouncedMarkRead();
    }
  }, [canMarkRead, debouncedMarkRead]);

  // Real-time trigger: mark read when new messages arrive while at bottom
  const prevPostsLengthRef = useRef(postsLength);
  useEffect(() => {
    const prevLength = prevPostsLengthRef.current;
    prevPostsLengthRef.current = postsLength;

    const hasNewPosts = postsLength > prevLength && prevLength > 0;
    if (hasNewPosts && isAtBottom && !isJumpMode) {
      debouncedMarkRead.flush();
    }
  }, [postsLength, isAtBottom, isJumpMode, debouncedMarkRead]);
}
