"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Clock, Effect } from "effect";
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
    api.tryouts.mutations.responses.save
  ).withOptimisticUpdate((localStore, args) => {
    const selectedAt = Effect.runSync(Clock.currentTimeMillis);
    updateRuntimeQueries(
      localStore,
      api.tryouts.queries.runtime.getSectionAttemptState,
      args,
      selectedAt
    );
    updateRuntimeQueries(
      localStore,
      api.tryouts.queries.runtime.getSetAttemptState,
      args,
      selectedAt
    );
  });
  const tExercises = useTranslations("Exercises");

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
        Effect.catchTag("UnknownError", ({ cause }) =>
          handleSubmitError(cause, tExercises)
        )
      )
    );
  };
}

type OptimisticStore = Parameters<
  Parameters<ReturnType<typeof useMutation>["withOptimisticUpdate"]>[0]
>[0];
type SaveResponseArgs = Parameters<
  Parameters<ReturnType<typeof useMutation>["withOptimisticUpdate"]>[0]
>[1];

function updateRuntimeQueries<
  Query extends
    | typeof api.tryouts.queries.runtime.getSectionAttemptState
    | typeof api.tryouts.queries.runtime.getSetAttemptState,
>(
  localStore: OptimisticStore,
  query: Query,
  args: SaveResponseArgs,
  selectedAt: number
) {
  const queries = localStore.getAllQueries(query);
  for (const cached of queries) {
    const state = cached.value;
    if (!state?.runtime) {
      continue;
    }
    const runtime = applyOptimisticTryoutResponse(
      state.runtime,
      args,
      selectedAt
    );
    if (runtime) {
      localStore.setQuery(query, cached.args, { ...state, runtime });
    }
  }
}

function handleSubmitError(
  error: unknown,
  tExercises: ReturnType<typeof useTranslations>
) {
  const errorCode = readErrorCode(error);
  if (
    errorCode === "TRYOUT_EXPIRED" ||
    errorCode === "TRYOUT_ATTEMPT_NOT_ACTIVE" ||
    errorCode === "TRYOUT_SECTION_NOT_ACTIVE"
  ) {
    return Effect.sync(() => {
      toast.info(tExercises("attempt-not-in-progress"), {
        position: "bottom-center",
      });
    });
  }
  return reportClientException(error, {
    ...(errorCode ? { convex_error_code: errorCode } : {}),
    source: "tryout-submit-answer",
  }).pipe(
    Effect.andThen(
      Effect.sync(() => {
        toast.error(tExercises("submit-answer-error"), {
          position: "bottom-center",
        });
      })
    )
  );
}

function readErrorCode(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return;
  }
  const data: unknown = error.data;
  if (!(typeof data === "object" && data !== null && "code" in data)) {
    return;
  }
  return typeof data.code === "string" ? data.code : undefined;
}
