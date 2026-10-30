import { Array as Arr, Effect } from "effect";
import { useEffect, useRef } from "react";
import { keptStorage } from "@/components/player/storage";
import { keptPicks } from "@/components/tryout/runtime/response/keep";
import { useSendPick } from "@/components/tryout/runtime/response/submit";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Sends again the picks that the browser kept for the section's questions, once its player shows: the picks
 * that a closed page or a reload left unsent or unconfirmed, as the School sitting does with its answers. Each
 * send shows the pick at once, so a reload brings it back on the screen, and a pick that a newer write
 * overtook since is refused as stale and dropped.
 */
export function useResendKeptPicks({
  locked,
  questions,
}: {
  /** A section whose time ran out takes no picks. */
  readonly locked: boolean;
  readonly questions: readonly TryoutRuntimeQuestion[];
}) {
  const send = useSendPick();
  const resumed = useRef(false);

  useEffect(() => {
    if (locked || resumed.current) {
      return;
    }
    resumed.current = true;
    Effect.runFork(
      keptPicks
        .answersFor(Arr.map(questions, (question) => question.placementId))
        .pipe(
          Effect.provide(keptStorage),
          Effect.flatMap((kept) =>
            Effect.forEach(
              kept,
              ({ answer, questionId }) =>
                send(
                  {
                    placementId: questionId,
                    selection: answer.response,
                    version: answer.version,
                  },
                  answer.answeredAt
                ),
              { discard: true }
            )
          ),
          Effect.catchTag("KeyValueStoreError", (error) =>
            reportClientException(error, {
              source: "components/tryout/runtime/response/kept",
            })
          )
        )
    );
  }, [locked, questions, send]);
}
