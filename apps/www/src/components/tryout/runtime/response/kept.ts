import { Array as Arr, Effect } from "effect";
import { useEffect, useRef } from "react";
import { keptStorage } from "@/components/player/storage";
import { usePickLedger } from "@/components/tryout/runtime/response/submit";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

/**
 * Sends again the picks that the browser kept for the section's questions, once its player shows: the picks
 * that a closed page or a reload left unsent or unconfirmed, as the School sitting does with its answers. Each
 * send shows the pick at once, so a reload brings it back on the screen, and a pick that a newer write
 * overtook since is refused as stale and dropped. The failures of the pass show one toast.
 */
export function useResendKeptPicks({
  locked,
  questions,
}: {
  /** A section whose time ran out takes no picks. */
  readonly locked: boolean;
  readonly questions: readonly TryoutRuntimeQuestion[];
}) {
  const ledger = usePickLedger();
  const resumed = useRef(false);

  useEffect(() => {
    if (locked || resumed.current) {
      return;
    }
    resumed.current = true;
    Effect.runFork(
      ledger
        .resend(Arr.map(questions, (question) => question.placementId))
        .pipe(Effect.provide(keptStorage))
    );
  }, [ledger, locked, questions]);
}
