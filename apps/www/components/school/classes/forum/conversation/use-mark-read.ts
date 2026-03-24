"use client";

import { useDebouncedCallback } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useRef } from "react";

/**
 * Encapsulate forum read-state writes behind explicit event handlers.
 */
export function useMarkRead({ forumId }: { forumId: Id<"schoolClassForums"> }) {
  const markRead = useMutation(
    api.classes.forums.mutations.readState.markForumRead
  );
  const lastSyncedPostIdRef = useRef<Id<"schoolClassForumPosts"> | undefined>(
    undefined
  );

  const debouncedMarkRead = useDebouncedCallback(
    (lastReadPostId: Id<"schoolClassForumPosts">) => {
      if (lastSyncedPostIdRef.current === lastReadPostId) {
        return;
      }

      markRead({ forumId, lastReadPostId })
        .then(() => {
          lastSyncedPostIdRef.current = lastReadPostId;
        })
        .catch(() => {
          // Keep the previous synced post id so a later bottom/new-post event
          // can retry naturally.
        });
    },
    {
      delay: 1000,
      flushOnUnmount: true,
    }
  );

  /**
   * Queue a debounced mark-read when the user reaches the latest visible post.
   */
  const scheduleMarkRead = useCallback(
    (lastReadPostId: Id<"schoolClassForumPosts"> | undefined) => {
      if (!lastReadPostId) {
        return;
      }

      debouncedMarkRead(lastReadPostId);
    },
    [debouncedMarkRead]
  );

  /**
   * Flush immediately when a newer post arrives while the user stays at bottom.
   */
  const flushMarkRead = useCallback(
    (lastReadPostId: Id<"schoolClassForumPosts"> | undefined) => {
      if (!lastReadPostId) {
        return;
      }

      debouncedMarkRead(lastReadPostId);
      debouncedMarkRead.flush();
    },
    [debouncedMarkRead]
  );

  /**
   * Cancel a pending mark-read when the user scrolls away from bottom.
   */
  const cancelPendingMarkRead = useCallback(() => {
    debouncedMarkRead.cancel();
  }, [debouncedMarkRead]);

  return {
    cancelPendingMarkRead,
    flushMarkRead,
    scheduleMarkRead,
  };
}
