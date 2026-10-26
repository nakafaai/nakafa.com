import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Result } from "effect";
import { updateRuntimeQueries } from "@/components/tryout/runtime/cache";
import { flagTryoutQuestion } from "@/components/tryout/runtime/flag";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Flags one question of the running section to come back to it, or takes the
 * flag off. The flag shows at once in every cached copy of the section. When
 * the server refuses it, Convex drops the optimistic flag with the failed
 * mutation, so the question shows the server's flag again, and one toast says
 * that the flag was not kept.
 */
export function useTryoutFlag() {
  const saveFlag = useMutation(
    tryouts.mutations.responses.flag
  ).withOptimisticUpdate((localStore, args) => {
    const change = (runtime: TryoutSectionRuntime) =>
      flagTryoutQuestion(runtime, args);
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

  /** Reports a refused or failed flag with one toast, and keeps the exception for diagnosis. */
  function reportFailure(error: unknown) {
    return reportClientException(error, { source: "tryout-flag" }).pipe(
      Effect.andThen(
        Effect.sync(() => {
          toast.error(
            {
              description: "tryout-flag-error.description",
              title: "tryout-flag-error.title",
            },
            { position: "bottom-center" }
          );
        })
      )
    );
  }

  return (question: TryoutRuntimeQuestion, flagged: boolean) => {
    Effect.runFork(
      Effect.tryPromise(() =>
        saveFlag({ flagged, placementId: question.placementId })
      ).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onFailure: reportFailure,
            onSuccess: () => Effect.void,
          })
        ),
        Effect.catchTag("UnknownError", ({ cause }) => reportFailure(cause))
      )
    );
  };
}
