"use client";

import type { Ref } from "@confect/core";
import { type InvokeReturn, useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Clock, Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateTryoutRuntime } from "@/components/tryout/runtime/cache.client";
import { notifyTryoutFailure } from "@/components/tryout/runtime/failure.client";
import {
  applyOptimisticTryoutResponse,
  type TryoutResponseSelection,
} from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

type SaveResponse = typeof refs.public.tryouts.mutations.responses.save;

/** Owns the mutation, optimistic cache, and failure feedback for responses. */
export function useTryoutResponseSubmit() {
  const saveResponse = useMutation(
    refs.public.tryouts.mutations.responses.save
  ).withOptimisticUpdate((localStore, args) => {
    const selectedAt = Effect.runSync(Clock.currentTimeMillis);
    updateTryoutRuntime(localStore, (runtime) =>
      applyOptimisticTryoutResponse(runtime, args, selectedAt)
    );
  });
  const tExercises = useTranslations("Exercises");
  const tPlayer = useTranslations("Player");
  return (
    question: TryoutRuntimeQuestion,
    selection: TryoutResponseSelection | null
  ) =>
    sendResponse({
      copy: {
        ended: tExercises("attempt-not-in-progress"),
        message: tExercises("submit-answer-error"),
        retry: tPlayer("retry"),
      },
      question,
      saveResponse,
      selection,
    });
}

/**
 * Saves one choice. A newer save of the same question dismisses an older
 * failure, so its retry can never overwrite a newer choice.
 */
function sendResponse(input: {
  readonly copy: {
    readonly ended: string;
    readonly message: string;
    readonly retry: string;
  };
  readonly question: TryoutRuntimeQuestion;
  readonly saveResponse: (
    args: Ref.Args<SaveResponse>
  ) => InvokeReturn<SaveResponse>;
  readonly selection: TryoutResponseSelection | null;
}) {
  const toastId = `tryout-response-${input.question.placementId}`;
  toast.dismiss(toastId);
  const notify = (error: unknown, code?: string) =>
    notifyTryoutFailure({
      code,
      ended: input.copy.ended,
      error,
      message: input.copy.message,
      retry: { label: input.copy.retry, run: () => sendResponse(input) },
      source: "tryout-submit-answer",
      toastId,
    });
  Effect.runFork(
    Effect.tryPromise(() =>
      input.saveResponse({
        placementId: input.question.placementId,
        selection: input.selection,
      })
    ).pipe(
      Effect.flatMap((result) =>
        Result.match(result, {
          onFailure: (error) => notify(error, error.code),
          onSuccess: () => Effect.void,
        })
      ),
      Effect.catchTag("UnknownError", ({ cause }) => notify(cause))
    )
  );
}
