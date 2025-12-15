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
  lastPostTime,
  isAtBottom,
  isJumpMode,
}: {
  forumId: Id<"schoolClassForums">;
  lastPostTime: number | undefined;
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

  // Real-time trigger: mark read when new messages arrive while at bottom
  // Track by lastPostTime to detect actual new posts (not pagination)
  const prevLastPostTimeRef = useRef(lastPostTime);
  useEffect(() => {
    const prevTime = prevLastPostTimeRef.current;
    prevLastPostTimeRef.current = lastPostTime;

    // Only flush if a genuinely newer post arrived (not older posts from pagination)
    const hasNewerPost =
      lastPostTime !== undefined &&
      prevTime !== undefined &&
      lastPostTime > prevTime;

    if (hasNewerPost && isAtBottom && !isJumpMode) {
      debouncedMarkRead.flush();
    }
  }, [lastPostTime, isAtBottom, isJumpMode, debouncedMarkRead]);
}
