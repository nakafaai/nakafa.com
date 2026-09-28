import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useState } from "react";
import {
  type ConversationUnreadCue,
  getInitialConversationUnreadCue,
} from "@/components/school/classes/forum/conversation/data/transcript/unread";

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
  forumId,
  isPending,
  posts,
}: {
  forumId: Id<"schoolClassForums">;
  isPending: boolean;
  posts: Parameters<typeof getInitialConversationUnreadCue>[0];
}) {
  const [seedState, setSeedState] = useState<{
    cue: ReturnType<typeof getInitialConversationUnreadCue> | null;
    forumId: Id<"schoolClassForums">;
    hasSeeded: boolean;
    isAcknowledged: boolean;
  }>({
    cue: null,
    forumId,
    hasSeeded: false,
    isAcknowledged: false,
  });

  let currentSeedState = seedState;

  if (currentSeedState.forumId !== forumId) {
    currentSeedState = {
      cue: null,
      forumId,
      hasSeeded: false,
      isAcknowledged: false,
    };
  }

  if (!(currentSeedState.hasSeeded || isPending)) {
    currentSeedState = {
      ...currentSeedState,
      cue: getInitialConversationUnreadCue(posts),
      hasSeeded: true,
    };
  }

  if (currentSeedState !== seedState) {
    setSeedState(currentSeedState);
  }

  const seededCue = currentSeedState.cue;
  const unreadCue = seededCue
    ? ({
        ...seededCue,
        status: currentSeedState.isAcknowledged ? "history" : "new",
      } satisfies ConversationUnreadCue)
    : null;

  /** Keeps the separator row but turns it into "you left off here". */
  const acknowledgeUnreadCue = () => {
    if (!seededCue) {
      return;
    }

    setSeedState((current) => {
      if (current.forumId !== forumId || current.isAcknowledged) {
        return current;
      }

      return {
        ...current,
        isAcknowledged: true,
      };
    });
  };

  return {
    acknowledgeUnreadCue,
    unreadCue,
  };
}
