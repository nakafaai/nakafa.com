import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Clock, Effect, Result } from "effect";
import { updateRuntimeQueries } from "@/components/tryout/runtime/response/cache";
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
 * Owns the mutation, optimistic cache, and error boundary for responses. Each
 * write carries the next version of its question. When the server refuses it
 * because a newer write took its place, Convex drops the optimistic value with
 * the failed mutation and the screen shows the server's value again.
 */
export function useTryoutResponseSubmit() {
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
    question: TryoutRuntimeQuestion,
    selection: TryoutResponseSelection | null
  ) => {
    const version = nextTryoutResponseVersion(question);
    Effect.runFork(
      Effect.tryPromise(() =>
        saveResponse({
          placementId: question.placementId,
          selection,
          version,
        })
      ).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onSuccess: () => Effect.void,
            onFailure: (error) => handleSubmitError(error, error.code),
          })
        ),
        Effect.catchTag("UnknownError", ({ cause }) => handleSubmitError(cause))
      )
    );
  };
}
