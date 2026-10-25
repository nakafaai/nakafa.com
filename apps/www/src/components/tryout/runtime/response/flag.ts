import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Result } from "effect";
import { updateRuntimeQueries } from "@/components/tryout/runtime/response/cache";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Flags or unflags one question of the running section for review. The flag shows at once, and a refused
 * write rolls back with its failed mutation, so the learner sees the server's state again and one toast.
 */
export function useTryoutFlag() {
  const setFlag = useMutation(
    tryouts.mutations.responses.flag
  ).withOptimisticUpdate((localStore, args) => {
    const change = (runtime: TryoutSectionRuntime) => ({
      ...runtime,
      questions: Arr.map(runtime.questions, (question) =>
        question.placementId === args.placementId
          ? { ...question, flagged: args.flagged }
          : question
      ),
    });
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
        setFlag({ flagged, placementId: question.placementId })
      ).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onSuccess: () => Effect.void,
            onFailure: reportFailure,
          })
        ),
        Effect.catchTag("UnknownError", ({ cause }) => reportFailure(cause))
      )
    );
  };
}
