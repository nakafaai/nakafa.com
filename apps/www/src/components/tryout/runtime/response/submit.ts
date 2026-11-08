import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Clock, Effect } from "effect";
import { keptStorage } from "@/components/player/storage";
import { updateRuntimeQueries } from "@/components/tryout/runtime/cache";
import {
  keptPicks,
  pickCopy,
  pickRefusal,
} from "@/components/tryout/runtime/response/keep";
import {
  applyOptimisticTryoutResponse,
  nextTryoutResponseVersion,
} from "@/components/tryout/runtime/response/state";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

/**
 * The ledger of the try-out's kept picks, bound to the save of one pick. The optimistic cache shows the pick
 * at once. When the server refuses it because a newer write took its place, Convex drops the optimistic value
 * with the failed mutation and the screen shows the server's value again.
 */
export function usePickLedger() {
  const saveResponse = useMutation(
    tryouts.mutations.responses.save
  ).withOptimisticUpdate((localStore, args) => {
    const selectedAt = Effect.runSync(Clock.currentTimeMillis);
    const change = (runtime: TryoutSectionRuntime) =>
      applyOptimisticTryoutResponse(runtime, args, selectedAt);
    updateRuntimeQueries(
      localStore,
      tryouts.queries.runtime.getSectionAttemptState,
      change
    );
    updateRuntimeQueries(
      localStore,
      tryouts.queries.runtime.getSetAttemptState,
      change
    );
  });

  return keptPicks.bind({
    copyOf: pickCopy,
    refusal: pickRefusal,
    send: (placementId: TryoutRuntimeQuestion["placementId"], pick) =>
      Effect.tryPromise(() => saveResponse({ placementId, ...pick })).pipe(
        Effect.flatMap(Effect.fromResult)
      ),
    source: "tryout-submit-answer",
  });
}

/**
 * Picks one response for a question: the browser keeps it before it is sent, numbered one above the version
 * the question shows, so a reload, a closed tab, or a connection that is down or still signing in never loses
 * it. The player sends every kept pick again once its questions show.
 */
export function useTryoutResponseSubmit() {
  const ledger = usePickLedger();

  return (question: TryoutRuntimeQuestion, response: ExamResponse | null) => {
    Effect.runFork(
      ledger
        .choose(question.placementId, {
          response,
          version: nextTryoutResponseVersion(question),
        })
        .pipe(Effect.provide(keptStorage))
    );
  };
}
