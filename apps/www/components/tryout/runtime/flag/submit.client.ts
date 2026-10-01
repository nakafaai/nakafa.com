"use client";

import type { Ref } from "@confect/core";
import { type InvokeReturn, useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateTryoutRuntime } from "@/components/tryout/runtime/cache.client";
import { notifyTryoutFailure } from "@/components/tryout/runtime/failure.client";
import { applyOptimisticTryoutFlag } from "@/components/tryout/runtime/flag/state";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

type SetFlag = typeof refs.public.tryouts.mutations.flags.set;

/**
 * Flags or clears one question at once. The mutation sets the intended state,
 * so a retry after a failure sends the same value again safely.
 */
export function useTryoutFlagSubmit() {
  const setFlag = useMutation(
    refs.public.tryouts.mutations.flags.set
  ).withOptimisticUpdate((localStore, args) =>
    updateTryoutRuntime(localStore, (runtime) =>
      applyOptimisticTryoutFlag(runtime, args)
    )
  );
  const tExercises = useTranslations("Exercises");
  const tPlayer = useTranslations("Player");
  return (question: TryoutRuntimeQuestion, flagged: boolean) =>
    sendFlag({
      copy: {
        ended: tExercises("attempt-not-in-progress"),
        message: tPlayer("flag-error"),
        retry: tPlayer("retry"),
      },
      flagged,
      question,
      setFlag,
    });
}

/** Sends one flag; a failure offers the same request again. */
function sendFlag(input: {
  readonly copy: {
    readonly ended: string;
    readonly message: string;
    readonly retry: string;
  };
  readonly flagged: boolean;
  readonly question: TryoutRuntimeQuestion;
  readonly setFlag: (args: Ref.Args<SetFlag>) => InvokeReturn<SetFlag>;
}) {
  const toastId = `tryout-flag-${input.question.placementId}`;
  toast.dismiss(toastId);
  const notify = (error: unknown, code?: string) =>
    notifyTryoutFailure({
      code,
      ended: input.copy.ended,
      error,
      message: input.copy.message,
      retry: { label: input.copy.retry, run: () => sendFlag(input) },
      source: "tryout-flag",
      toastId,
    });
  Effect.runFork(
    Effect.tryPromise(() =>
      input.setFlag({
        flagged: input.flagged,
        placementId: input.question.placementId,
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
