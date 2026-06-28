import { useState } from "react";
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
export function useUnreadCue({
  isPending,
  posts,
}: {
  isPending: boolean;
  posts: Parameters<typeof getInitialConversationUnreadCue>[0];
}) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [seedState, setSeedState] = useState<{
    cue: ReturnType<typeof getInitialConversationUnreadCue> | null;
    hasSeeded: boolean;
  }>({
    cue: null,
    hasSeeded: false,
  });

  let currentSeedState = seedState;

  if (!(seedState.hasSeeded || isPending)) {
    currentSeedState = {
      cue: getInitialConversationUnreadCue(posts),
      hasSeeded: true,
    };
    setSeedState(currentSeedState);
  }

  const seededCue = currentSeedState.cue;
  const unreadCue = seededCue
    ? ({
        ...seededCue,
        status: isAcknowledged ? "history" : "new",
      } satisfies ConversationUnreadCue)
    : null;

  /** Keeps the separator row but turns it into "you left off here". */
  const acknowledgeUnreadCue = () => {
    if (!seededCue) {
      return;
    }

    setIsAcknowledged((current) => (current ? current : true));
  };

  return {
    acknowledgeUnreadCue,
    unreadCue,
  };
}
