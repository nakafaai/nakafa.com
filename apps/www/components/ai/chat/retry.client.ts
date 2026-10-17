"use client";

import type { Ref } from "@confect/core";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { startTransition, useEffect, useState } from "react";
import { makeAnswerRetry } from "@/components/ai/chat/retry";
import { awaitServerAnswer } from "@/lib/convex/answer";

/**
 * Retries a share link that the server could not load in a way the query does
 * not declare. Its readers have unmounted, so nothing subscribes to the query.
 * Until the next server message replaces the cache, a remount would read the
 * failure that the cache still holds, so the retry waits for the server's answer
 * first, then remounts the readers, which read that answer and subscribe.
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
  const [controller] = useState(() => makeAnswerRetry());

  // Unmounting ChatSharing interrupts the wait, which ends its subscription.
  // Closing the dialog keeps ChatSharing mounted, so the wait goes on.
  useEffect(
    () => () => {
      Effect.runFork(controller.dispose());
    },
    [controller]
  );

  /**
   * Starts a wait for the server's answer. The controller ends the wait that is
   * still open, if there is one, which ends its subscription.
   */
  function retry() {
    setWaiting(true);
    Effect.runFork(
      controller.retry(
        awaitServerAnswer(convex, ref, args).pipe(Effect.scoped),
        {
          // The remount and the end of the wait are one transition, so Retry stays
          // disabled until the readers replace the failure. The answer has come, so
          // no async action is open for this transition to wait on, and the page's
          // other transitions are not held.
          answered: () =>
            startTransition(() => {
              remount();
              setWaiting(false);
            }),
          // A wait that ends without an answer clears the flag, and never remounts.
          ended: () => setWaiting(false),
        }
      )
    );
  }

  return { retry, waiting };
}
