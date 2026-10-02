"use client";

import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Clock, Effect, Option, Result } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  applyOptimisticTryoutResponse,
  type TryoutResponseSelection,
} from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";
import { reportClientException } from "@/lib/analytics/client";

/** Owns the mutation, optimistic cache, and error boundary for responses. */
export function useTryoutResponseSubmit() {
  const saveResponse = useMutation(
    refs.public.tryouts.mutations.responses.save
  ).withOptimisticUpdate((localStore, args) => {
    const selectedAt = Effect.runSync(Clock.currentTimeMillis);
    updateRuntimeQueries(
      localStore,
      refs.public.tryouts.queries.runtime.getSectionAttemptState,
      args,
      selectedAt
    );
    updateRuntimeQueries(
      localStore,
      refs.public.tryouts.queries.runtime.getSetAttemptState,
      args,
      selectedAt
    );
  });
  const tTryouts = useTranslations("Tryouts");
  return (
    question: TryoutRuntimeQuestion,
    selection: TryoutResponseSelection | null
  ) => {
    Effect.runFork(
      Effect.tryPromise(() =>
        saveResponse({
          placementId: question.placementId,
          selection,
        })
      ).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              handleSubmitError(error, tTryouts, error.code),
          })
        ),
        Effect.catchTag("UnknownError", ({ cause }) =>
          handleSubmitError(cause, tTryouts)
        )
      )
    );
  };
}
type OptimisticStore = Parameters<
  Parameters<ReturnType<typeof useMutation>["withOptimisticUpdate"]>[0]
>[0];
type SaveResponseArgs = Ref.Args<
  typeof refs.public.tryouts.mutations.responses.save
>;

function updateRuntimeQueries<
  Query extends
    | typeof refs.public.tryouts.queries.runtime.getSectionAttemptState
    | typeof refs.public.tryouts.queries.runtime.getSetAttemptState,
>(
  localStore: OptimisticStore,
  query: Query,
  args: SaveResponseArgs,
  selectedAt: number
) {
  const queries = localStore.getAllQueries(query);
  for (const cached of queries) {
    const state = Option.getOrUndefined(cached.value);
    if (!state?.runtime) {
      continue;
    }
    const runtime = applyOptimisticTryoutResponse(
      state.runtime,
      args,
      selectedAt
    );
    if (runtime) {
      localStore.setQuery(
        query,
        cached.args,
        Option.some({
          ...state,
          runtime,
        })
      );
    }
  }
}
function handleSubmitError(
  error: unknown,
  tTryouts: ReturnType<typeof useTranslations>,
  errorCode?: Ref.Error<
    typeof refs.public.tryouts.mutations.responses.save
  >["code"]
) {
  if (
    errorCode === "TRYOUT_EXPIRED" ||
    errorCode === "TRYOUT_ATTEMPT_NOT_ACTIVE" ||
    errorCode === "TRYOUT_SECTION_NOT_ACTIVE"
  ) {
    return Effect.sync(() => {
      toast.info(tTryouts("attempt-not-in-progress"), {
        position: "bottom-center",
      });
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
        toast.error(tTryouts("submit-answer-error"), {
          position: "bottom-center",
        });
      })
    )
  );
}
