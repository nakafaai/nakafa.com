"use client";

import { Effect } from "effect";
import { useState } from "react";

/**
 * Runs the changes a learner makes to a chat, such as renaming, sharing or
 * deleting it. A change starts at once, and Convex shows its optimistic result
 * through a state update. `isPending` is plain state, not a transition: a
 * transition that waited for the server would hold every navigation the learner
 * makes meanwhile, because React makes each transition wait for a pending one.
 */
export function useChange() {
  const [isPending, setPending] = useState(false);

  /** Starts the change now, and keeps `isPending` true until what it returns settles. */
  function change(start: () => Promise<void>) {
    setPending(true);
    Effect.runFork(
      Effect.promise(start).pipe(
        Effect.ensuring(Effect.sync(() => setPending(false)))
      )
    );
  }

  return { change, isPending };
}
