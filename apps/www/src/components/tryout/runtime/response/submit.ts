import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Cause, Clock, Effect, Option } from "effect";
import { settleSent } from "@/components/player/keep";
import { keptStorage } from "@/components/player/storage";
import { updateRuntimeQueries } from "@/components/tryout/runtime/cache";
import {
  isFinalPickRefusal,
  keptPicks,
} from "@/components/tryout/runtime/response/keep";
import {
  applyOptimisticTryoutResponse,
  nextTryoutResponseVersion,
  type TryoutResponseSelection,
  tryoutSubmitFailureOf,
} from "@/components/tryout/runtime/response/state";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Sends one pick and settles the copy the browser keeps of it: the server's
 * answer drops it, and so does a refusal that it will never take back. The
 * optimistic cache shows the pick at once. When the server refuses it because a
 * newer write took its place, Convex drops the optimistic value with the failed
 * mutation and the screen shows the server's value again.
 */
export function useSendPick() {
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
  /** Reports a failed answer: an ended attempt tells the learner to start again, a stale write is not reported, and any other failure is reported. */
  function handleSubmitError(
    error: unknown,
    errorCode?: Ref.Error<typeof tryouts.mutations.responses.save>["code"]
  ) {
    const failure = tryoutSubmitFailureOf(errorCode);
    if (failure === "stale") {
      return Effect.void;
    }
    if (failure === "ended") {
      return Effect.sync(() => {
        toast.info(
          {
            description: "tryout-attempt-not-in-progress.description",
            title: "tryout-attempt-not-in-progress.title",
          },
          { position: "bottom-center" }
        );
      });
    }
    return reportClientException(error, {
      ...(errorCode
        ? {
            convex_error_code: errorCode,
          }
        : {}),
      source: "tryout-submit-answer",
    }).pipe(
      Effect.andThen(
        Effect.sync(() => {
          toast.error(
            {
              description: "tryout-submit-answer-error.description",
              title: "tryout-submit-answer-error.title",
            },
            { position: "bottom-center" }
          );
        })
      )
    );
  }
  return (
    pick: Ref.Args<typeof tryouts.mutations.responses.save>,
    answeredAt: number
  ) =>
    settleSent(
      Effect.tryPromise(() => saveResponse(pick)).pipe(
        Effect.flatMap(Effect.fromResult)
      ),
      keptPicks
        .confirm(pick.placementId, answeredAt)
        .pipe(
          Effect.provide(keptStorage),
          Effect.catchTag("KeyValueStoreError", reportStorageFailure)
        ),
      isFinalPickRefusal
    ).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: (failure) =>
            Cause.isUnknownError(failure)
              ? handleSubmitError(failure.cause)
              : handleSubmitError(failure, failure.code),
        })
      )
    );
}

/** Reports a browser that refuses to keep a pick; the pick is still sent. */
function reportStorageFailure(error: unknown) {
  return reportClientException(error, {
    source: "components/tryout/runtime/response/submit",
  });
}

/**
 * Picks one response for a question: the browser keeps it before it is sent,
 * numbered one above the version the question shows, so a reload, a closed tab,
 * or a connection that is down or still signing in never loses it. The player
 * sends every kept pick again once its questions show.
 */
export function useTryoutResponseSubmit() {
  const send = useSendPick();

  return (
    question: TryoutRuntimeQuestion,
    selection: TryoutResponseSelection | null
  ) => {
    const answeredAt = Effect.runSync(Clock.currentTimeMillis);
    const version = nextTryoutResponseVersion(question);
    Effect.runSync(
      keptPicks
        .keep(question.placementId, {
          answeredAt,
          response: selection,
          version,
        })
        .pipe(
          Effect.provide(keptStorage),
          Effect.catchTag("KeyValueStoreError", reportStorageFailure)
        )
    );
    Effect.runFork(
      send(
        { placementId: question.placementId, selection, version },
        answeredAt
      )
    );
  };
}
