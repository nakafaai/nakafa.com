import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/types";

export interface UnreadCue {
  count: number;
  postId: Id<"schoolClassForumPosts">;
  status: "history" | "new";
}

interface UseUnreadResult {
  acknowledgeUnreadCue: () => void;
  unreadCue: UnreadCue | null;
}

type LiveUnreadCue = Omit<UnreadCue, "status">;

/** Resolves the unread cue visible in the current live transcript window. */
function getLiveUnreadCue({
  baselineLatestPostId,
  isDetachedMode,
  posts,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  isDetachedMode: boolean;
  posts: ForumPost[];
}): LiveUnreadCue | null {
  if (isDetachedMode) {
    return null;
  }

  let count = 0;
  let passedBaselineLatestPost = baselineLatestPostId === null;
  let postId: Id<"schoolClassForumPosts"> | null = null;

  for (const post of posts) {
    const isUnread = !passedBaselineLatestPost && post.isUnread === true;

    if (isUnread) {
      postId ??= post._id;
      count += 1;
    }

    if (post._id === baselineLatestPostId) {
      passedBaselineLatestPost = true;
    }
  }

  if (!(postId && count > 0)) {
    return null;
  }

  return { count, postId };
}

/**
 * Owns the session-scoped unread cue so the separator stays stable while one
 * conversation remains open, then resets naturally on the next session.
 */
export function useUnread({
  baselineLatestPostId,
  isDetachedMode,
  isInitialLoading,
  posts,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  isDetachedMode: boolean;
  isInitialLoading: boolean;
  posts: ForumPost[];
}): UseUnreadResult {
  const [isCueAcknowledged, setIsCueAcknowledged] = useState(false);
  const hasSeededCueRef = useRef(false);
  const seededCueRef = useRef<LiveUnreadCue | null>(null);
  const liveUnreadCue = useMemo(
    () =>
      getLiveUnreadCue({
        baselineLatestPostId,
        isDetachedMode,
        posts,
      }),
    [baselineLatestPostId, isDetachedMode, posts]
  );

  if (!(hasSeededCueRef.current || isInitialLoading || isDetachedMode)) {
    hasSeededCueRef.current = true;
    seededCueRef.current = liveUnreadCue;
  }

  const unreadCue: UnreadCue | null = seededCueRef.current
    ? {
        ...seededCueRef.current,
        status: isCueAcknowledged ? "history" : "new",
      }
    : null;

  /** Marks the session cue as already read without removing its visual anchor. */
  const acknowledgeUnreadCue = useCallback(() => {
    if (!(seededCueRef.current && !isCueAcknowledged)) {
      return;
    }

    setIsCueAcknowledged(true);
  }, [isCueAcknowledged]);

  return {
    acknowledgeUnreadCue,
    unreadCue,
  };
}
