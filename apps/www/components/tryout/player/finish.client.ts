"use client";

import type { Ref } from "@confect/core";
import { type InvokeReturn, useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import {
  type TransitionStartFunction,
  useOptimistic,
  useTransition,
} from "react";
import { notifyTryoutFailure } from "@/components/tryout/runtime/failure.client";

type CompleteSection = typeof refs.public.tryouts.mutations.sections.complete;

/** The section a finish request completes. */
interface TryoutFinishTarget {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly sectionKey: string;
}

/** Finish actions a player session exposes. */
export interface TryoutFinishActions {
  /** True from the confirmation until the destination page commits. */
  readonly pending: boolean;
  /** Warms the destination route on intent. */
  readonly prepare: () => void;
  readonly run: (target: TryoutFinishTarget) => void;
}

/**
 * Finishes the running section inside a transition. The state shown stays
 * the running one (held with useOptimistic) until navigation commits, so the
 * section's own summary never flashes before the destination renders.
 */
export function useTryoutFinish<State>(input: {
  readonly returnHref: string;
  readonly state: State;
}): TryoutFinishActions & { readonly shown: State } {
  const [shown, hold] = useOptimistic(input.state);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const complete = useMutation(refs.public.tryouts.mutations.sections.complete);
  const tPlayer = useTranslations("Player");
  const tTryouts = useTranslations("Tryouts");

  return {
    pending,
    prepare: () => router.prefetch(input.returnHref),
    run: (target) => {
      if (pending) {
        return;
      }
      finishSection({
        complete,
        copy: {
          message: tTryouts("complete-part-error"),
          retry: tPlayer("retry"),
        },
        hold: () => hold(input.state),
        navigate: () => router.push(input.returnHref),
        startTransition,
        target,
      });
    },
    shown,
  };
}

/**
 * Completes the section and navigates inside one transition. An ended
 * section needs no toast; any other failure offers the same request again.
 */
function finishSection(input: {
  readonly complete: (
    args: Ref.Args<CompleteSection>
  ) => InvokeReturn<CompleteSection>;
  readonly copy: { readonly message: string; readonly retry: string };
  readonly hold: () => void;
  readonly navigate: () => void;
  readonly startTransition: TransitionStartFunction;
  readonly target: TryoutFinishTarget;
}) {
  const notify = (error: unknown, code?: string) =>
    notifyTryoutFailure({
      code,
      error,
      message: input.copy.message,
      retry: { label: input.copy.retry, run: () => finishSection(input) },
      source: "tryout-complete-section",
      toastId: "tryout-finish",
    }).pipe(Effect.as(false));
  input.startTransition(async () => {
    input.hold();
    const finished = await Effect.runPromise(
      Effect.tryPromise(() => input.complete(input.target)).pipe(
        Effect.flatMap((result) =>
          Result.match(result, {
            onFailure: (error) => notify(error, error.code),
            onSuccess: () => Effect.succeed(true),
          })
        ),
        Effect.catchTag("UnknownError", ({ cause }) => notify(cause))
      )
    );
    if (finished) {
      input.startTransition(input.navigate);
    }
  });
}
