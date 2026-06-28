import { useState } from "react";
import { getInitialConversationRestoreTarget } from "@/components/school/classes/forum/conversation/data/scroll-snapshot";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

type InitialRestoreTarget = ReturnType<
  typeof getInitialConversationRestoreTarget
>;

export interface RestoreState {
  hasBootstrapped: boolean;
  isPendingLatestPlacement: boolean;
  target: InitialRestoreTarget | null;
}

/** Bootstraps the initial transcript restore target exactly once per open forum. */
export function useRestoreState({
  initialSavedScrollSnapshot,
  isPending,
  unreadCue,
}: {
  initialSavedScrollSnapshot: ConversationScrollSnapshot | null;
  isPending: boolean;
  unreadCue: ConversationUnreadCue | null;
}) {
  const [restoreState, setRestoreState] = useState<RestoreState>({
    hasBootstrapped: false,
    isPendingLatestPlacement: false,
    target: null,
  });

  if (restoreState.hasBootstrapped || isPending) {
    return [restoreState, setRestoreState] as const;
  }

  const target = getInitialConversationRestoreTarget({
    savedScrollSnapshot: initialSavedScrollSnapshot,
    unreadCue,
  });
  const bootstrappedState = {
    hasBootstrapped: true,
    isPendingLatestPlacement: target.kind === "bottom",
    target,
  } satisfies RestoreState;

  setRestoreState(bootstrappedState);

  return [bootstrappedState, setRestoreState] as const;
}
