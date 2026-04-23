import { useCallback, useMemo, useRef, useState } from "react";
import {
  type ConversationUnreadCue,
  getInitialConversationUnreadCue,
} from "@/components/school/classes/forum/conversation/data/unread";

/**
 * Keeps the initial unread marker stable for one open conversation session.
 *
 * The cue is seeded once from the first resolved Convex result. Later live
 * posts are not added to the count because the viewer is already in-session.
 * A submit only downgrades the initial marker from "new" to "history".
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
  posts: Parameters<typeof getInitialConversationUnreadCue>[0];
}) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const hasSeededCueRef = useRef(false);
  const seededCueRef = useRef<ReturnType<
    typeof getInitialConversationUnreadCue
  > | null>(null);
  const initialCue = useMemo(
    () => getInitialConversationUnreadCue(posts),
    [posts]
  );

  if (!(hasSeededCueRef.current || isPending)) {
    hasSeededCueRef.current = true;
    seededCueRef.current = initialCue;
  }

  const seededCue = seededCueRef.current;
  const unreadCue = useMemo(() => {
    if (!seededCue) {
      return null;
    }

    return {
      ...seededCue,
      status: isAcknowledged ? "history" : "new",
    } satisfies ConversationUnreadCue;
  }, [isAcknowledged, seededCue]);

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
