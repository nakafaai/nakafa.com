import type { Ref } from "@confect/core";
import { useConvex } from "convex/react";
import { Effect, Fiber } from "effect";
import { startTransition, useEffect, useRef, useState } from "react";
import { awaitServerAnswer } from "@/lib/convex/answer";

/**
 * Retries a share link that the server could not load in a way the query does
 * not declare. Its readers have unmounted, so nothing subscribes to the query,
 * and a remount would read the failure that the cache still holds. The retry
 * waits for the server's answer first, then remounts the readers, which read
 * that answer and subscribe.
 *
 * The wait is one fiber. Its scope ends with the fiber, so its subscription ends
 * when the answer comes or when the fiber is interrupted.
 */
export function useAnswerRetry<Query extends Ref.AnyPublicQuery>(
  ref: Query,
  args: Ref.Args<Query>,
  remount: () => void
) {
  const convex = useConvex();
  // Plain state, not a transition. A transition that waits for the server would
  // hold every transition in the page until the answer comes, and so would the
  // page's navigation. See docs/adr/0017-state.md, "Pending Actions Are Not
  // Transitions".
  const [waiting, setWaiting] = useState(false);
  const wait = useRef<Fiber.Fiber<void> | null>(null);

  // Unmounting the dialog interrupts the wait, which ends its subscription.
  useEffect(() => () => interruptWait(wait.current), []);

  /**
   * Ends the previous wait if one is still open, then starts a wait for the
   * server's answer. Interrupting a wait ends its subscription.
   */
  function retry() {
    interruptWait(wait.current);
    setWaiting(true);
    wait.current = Effect.runFork(
      awaitServerAnswer(convex, ref, args).pipe(
        Effect.scoped,
        // The answer has come, so no async action is open for this transition to
        // wait on, and the page's other transitions are not held.
        Effect.andThen(Effect.sync(() => startTransition(remount))),
        Effect.ensuring(Effect.sync(() => setWaiting(false)))
      )
    );
  }

  return { retry, waiting };
}

/** Interrupts a wait that is still open, which ends its subscription. */
function interruptWait(wait: Fiber.Fiber<void> | null) {
  if (wait !== null) {
    Effect.runFork(Fiber.interrupt(wait));
  }
}
