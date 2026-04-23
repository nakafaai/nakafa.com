import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

export interface ConversationUnreadCue {
  count: number;
  postId: Id<"schoolClassForumPosts">;
  status: "history" | "new";
}

type LiveConversationUnreadCue = Omit<ConversationUnreadCue, "status">;

/** Finds the stable unread anchor from the current ascending transcript posts. */
export function getLiveConversationUnreadCue(posts: ForumPost[]) {
  let count = 0;
  let postId: Id<"schoolClassForumPosts"> | null = null;

  for (const post of posts) {
    if (!post.isUnread) {
      continue;
    }

    postId ??= post._id;
    count += 1;
  }

  if (!(postId && count > 0)) {
    return null;
  }

  return {
    count,
    postId,
  } satisfies LiveConversationUnreadCue;
}

/**
 * Keeps the unread marker stable for one open conversation session.
 *
 * The cue is seeded once from the first resolved Convex result, then a submit
 * only downgrades it from "new" to "history" instead of removing the row.
 *
 * References:
 * - https://react.dev/learn/you-might-not-need-an-effect
 * - https://react.dev/learn/referencing-values-with-refs
 * - https://react.dev/learn/state-as-a-snapshot
 */
export function useConversationUnreadCue({
  isPending,
  posts,
}: {
  isPending: boolean;
  posts: ForumPost[];
}) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const hasSeededCueRef = useRef(false);
  const seededCueRef = useRef<LiveConversationUnreadCue | null>(null);
  const liveCue = useMemo(() => getLiveConversationUnreadCue(posts), [posts]);

  if (!(hasSeededCueRef.current || isPending)) {
    hasSeededCueRef.current = true;
    seededCueRef.current = liveCue;
  }

  const unreadCue = seededCueRef.current
    ? ({
        ...seededCueRef.current,
        status: isAcknowledged ? "history" : "new",
      } satisfies ConversationUnreadCue)
    : null;

  /** Keeps the separator row but turns it into "you left off here". */
  const acknowledgeUnreadCue = useCallback(() => {
    if (!seededCueRef.current) {
      return;
    }

    setIsAcknowledged((current) => (current ? current : true));
  }, []);

  return {
    acknowledgeUnreadCue,
    unreadCue,
  };
}
