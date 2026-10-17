"use client";

import type { Ref } from "@confect/core";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { startTransition, useEffect, useState } from "react";
import { awaitServerAnswer } from "@/lib/convex/answer";
import { makeAnswerRetry } from "@/lib/convex/retry";

/**
 * Retries a query that the server could not answer in a way the query does not
 * declare. Its readers have unmounted, so nothing subscribes to the query. Until
 * the next server message replaces the cache, a remount would read the failure
 * that the cache still holds, so the retry waits for the server's answer first.
 * The wait keeps its subscription until the remounted readers have subscribed,
 * so they join it, and the server runs the query once.
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

  // Unmounting the component that holds this hook ends the open wait, which ends
  // its subscription. Closing the share dialog keeps ChatSharing mounted, so the
  // wait goes on.
  useEffect(
    () => () => {
      Effect.runFork(controller.dispose());
    },
    [controller]
  );

  // The remounted readers subscribe to the query in their passive effects. A
  // component that stays mounted, as ChatSharing does, ends the wait after them,
  // so the query keeps the readers and the server does not run it again. A
  // component that the remount unmounts ends its wait in the cleanup above.
  useEffect(() => {
    if (!waiting) {
      Effect.runFork(controller.release());
    }
  }, [controller, waiting]);

  /**
   * Starts a wait for the server's answer. A new wait replaces the open one, and
   * the controller ends the open one first.
   */
  function retry() {
    setWaiting(true);
    Effect.runFork(
      controller.retry(awaitServerAnswer(convex, ref, args), {
        // The remount and the end of the flag are one transition, so Retry stays
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
      })
    );
  }

  return { retry, waiting };
}
