import { useTimeout } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCallback, useRef, useState } from "react";

const FORUM_JUMP_HIGHLIGHT_DURATION = 1600;

/** Owns the transient jump highlight lifecycle for one conversation session. */
export function useConversationHighlight() {
  const pendingHighlightPostIdRef = useRef<Id<"schoolClassForumPosts"> | null>(
    null
  );
  const [highlightedPostId, setHighlightedPostId] =
    useState<Id<"schoolClassForumPosts"> | null>(null);
  const { clear: clearHighlightTimeout, start: startHighlightTimeout } =
    useTimeout(() => {
      setHighlightedPostId(null);
    }, FORUM_JUMP_HIGHLIGHT_DURATION);

  const clearJumpHighlight = useCallback(() => {
    pendingHighlightPostIdRef.current = null;
    clearHighlightTimeout();
    setHighlightedPostId(null);
  }, [clearHighlightTimeout]);

  const queueJumpHighlight = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      pendingHighlightPostIdRef.current = postId;
      clearHighlightTimeout();
      setHighlightedPostId(null);
    },
    [clearHighlightTimeout]
  );

  const handleHighlightVisiblePost = useCallback(
    (postId: Id<"schoolClassForumPosts">) => {
      if (pendingHighlightPostIdRef.current !== postId) {
        return;
      }

      pendingHighlightPostIdRef.current = null;
      clearHighlightTimeout();
      setHighlightedPostId(postId);
      startHighlightTimeout();
    },
    [clearHighlightTimeout, startHighlightTimeout]
  );

  return {
    clearJumpHighlight,
    handleHighlightVisiblePost,
    highlightedPostId,
    pendingHighlightPostId: pendingHighlightPostIdRef.current,
    queueJumpHighlight,
  };
}
