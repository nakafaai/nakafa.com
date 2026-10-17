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
 * first. The wait keeps its subscription until the remounted readers have
 * subscribed, so they join it, and the server runs the query once.
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

  // Unmounting ChatSharing ends the open wait, which ends its subscription.
  // Closing the dialog keeps ChatSharing mounted, so the wait goes on.
  useEffect(
    () => () => {
      Effect.runFork(controller.dispose());
    },
    [controller]
  );

  // React runs the passive effects of the remounted readers, which subscribe to
  // the query, before the effects of this component. So once the answer's
  // remount is committed, ending the wait's subscription leaves the query with
  // the readers, and the server does not run it again.
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
