"use client";

import type { InvokeReturn } from "@confect/react";
import type refs from "@repo/backend/confect/_generated/refs";
import type {
  StartAttemptArgs,
  StartAttemptResult,
} from "@repo/backend/confect/tryouts/start/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Data, Effect } from "effect";
import type { TransitionStartFunction } from "react";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

/** Expected client transport failure for a try-out action. */
class TryoutClientRequestError extends Data.TaggedError(
  "TryoutClientRequestError"
)<{
  readonly cause: unknown;
}> {}

/** The retry action a failure toast offers. */
export interface TryoutRetry {
  readonly label: string;
  readonly run: () => void;
}
interface StartAttemptProgramInput {
  readonly args: StartAttemptArgs;
  readonly failureMessage: string;
  readonly mutation: (
    args: StartAttemptArgs
  ) => InvokeReturn<typeof refs.public.tryouts.mutations.attempts.startAttempt>;
  readonly onSuccess: (result: StartAttemptResult) => Effect.Effect<void>;
  readonly retry: TryoutRetry;
}

/** Runs the free start mutation and reports transport or source failures. */
export const startAttemptProgram = Effect.fn("tryout.startAttempt")(
  (input: StartAttemptProgramInput) =>
    Effect.tryPromise({
      try: () => input.mutation(input.args),
      catch: (cause) => new TryoutClientRequestError({ cause }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError((cause) => new TryoutClientRequestError({ cause }))
        )
      ),
      Effect.tap((result) => input.onSuccess(result)),
      Effect.catchTag("TryoutClientRequestError", (error) =>
        reportRequestFailure(error, {
          message: input.failureMessage,
          retry: input.retry,
          source: "tryout-start",
        })
      ),
      Effect.asVoid
    )
);

/** Starts one section; the runtime appearing is the success feedback. */
export const startEntrySectionProgram = Effect.fn("tryout.startSection")(
  (input: {
    readonly attemptId: Id<"tryoutAttempts">;
    readonly failureMessage: string;
    readonly mutation: (args: {
      attemptId: Id<"tryoutAttempts">;
      sectionKey: string;
    }) => InvokeReturn<typeof refs.public.tryouts.mutations.sections.start>;
    readonly retry: TryoutRetry;
    readonly sectionKey: string;
  }) =>
    Effect.tryPromise({
      try: () =>
        input.mutation({
          attemptId: input.attemptId,
          sectionKey: input.sectionKey,
        }),
      catch: (cause) => new TryoutClientRequestError({ cause }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError((cause) => new TryoutClientRequestError({ cause }))
        )
      ),
      Effect.catchTag("TryoutClientRequestError", (error) =>
        reportRequestFailure(error, {
          message: input.failureMessage,
          retry: input.retry,
          source: "tryout-start-section",
        })
      ),
      Effect.asVoid
    )
);

/** Reports one unexpected request failure and offers a retry. */
function reportRequestFailure(
  error: unknown,
  feedback: {
    readonly message: string;
    readonly retry: TryoutRetry;
    readonly source: string;
  }
) {
  return reportClientException(error, { source: feedback.source }).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        toast.error(feedback.message, {
          action: { label: feedback.retry.label, onClick: feedback.retry.run },
          id: feedback.source,
          position: "bottom-center",
        });
      })
    )
  );
}

/** Runs one start program in a transition; a failure offers the same run. */
export function runTryoutStart(input: {
  readonly program: (retry: TryoutRetry) => Effect.Effect<void>;
  readonly retryLabel: string;
  readonly startTransition: TransitionStartFunction;
}) {
  input.startTransition(() =>
    Effect.runPromise(
      input.program({
        label: input.retryLabel,
        run: () => runTryoutStart(input),
      })
    )
  );
}
