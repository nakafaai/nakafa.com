import { Effect } from "effect";
import { useState } from "react";

/**
 * `useTransition`'s pair for an action that can outlast its press, such as a loop of batches. React entangles every
 * transition with a pending async action, and a navigation is a transition, so a real one would hold the viewer on the
 * page until the last batch answers (ADR 0017). Here the pending state is plain state, and the action runs detached,
 * so it finishes even when the viewer has moved on.
 */
export function useLongAction() {
  const [isPending, setIsPending] = useState(false);

  const start = (action: () => Promise<unknown>) => {
    setIsPending(true);
    Effect.runFork(
      Effect.promise(action).pipe(
        Effect.ensuring(Effect.sync(() => setIsPending(false)))
      )
    );
  };

  return [isPending, start] as const;
}
