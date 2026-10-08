"use client";

import type { InvokeReturn } from "@confect/react";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  type StartAttemptArgs,
  type StartAttemptResult,
  startAttemptArgsValidator,
} from "@repo/backend/confect/tryouts/start/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Data, Effect, Schema } from "effect";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

/** Expected client transport failure for a try-out action. */
class TryoutClientRequestError extends Data.TaggedError(
  "TryoutClientRequestError"
)<{
  readonly cause: unknown;
}> {}

/** Arguments and failure copy of one free start, without its callbacks. */
const StartAttemptProgramInputSchema = Schema.Struct({
  args: startAttemptArgsValidator,
  failureMessage: Schema.String,
});
type StartAttemptProgramInput = typeof StartAttemptProgramInputSchema.Type;

/** Calls the Convex start mutation with the attempt arguments. */
type StartAttemptMutation = (
  args: StartAttemptArgs
) => InvokeReturn<typeof refs.public.tryouts.mutations.attempts.startAttempt>;

/** Continues the client flow with the result of a started attempt. */
type StartAttemptSuccess = (result: StartAttemptResult) => Effect.Effect<void>;

/** Runs the free start mutation and reports transport or source failures. */
export const startAttemptProgram = Effect.fn("tryout.startAttempt")(
  (
    input: StartAttemptProgramInput,
    mutation: StartAttemptMutation,
    onSuccess: StartAttemptSuccess
  ) =>
    Effect.tryPromise({
      try: () => mutation(input.args),
      catch: (cause) => new TryoutClientRequestError({ cause }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError((cause) => new TryoutClientRequestError({ cause }))
        )
      ),
      Effect.tap((result) => onSuccess(result)),
      Effect.catchTag("TryoutClientRequestError", (error) =>
        reportRequestFailure(error, "tryout-start", input.failureMessage)
      ),
      Effect.asVoid
    )
);

/** Starts one section and preserves the existing success and fallback feedback. */
export const startEntrySectionProgram = Effect.fn("tryout.startSection")(
  (input: {
    readonly attemptId: Id<"tryoutAttempts">;
    readonly failureMessage: string;
    readonly mutation: (args: {
      attemptId: Id<"tryoutAttempts">;
      sectionKey: string;
    }) => InvokeReturn<typeof refs.public.tryouts.mutations.sections.start>;
    readonly sectionKey: string;
    readonly successMessage: string;
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
      Effect.tap(() => showSuccess(input.successMessage)),
      Effect.catchTag("TryoutClientRequestError", (error) =>
        reportRequestFailure(
          error,
          "tryout-start-section",
          input.failureMessage
        )
      ),
      Effect.asVoid
    )
);

/** Reports one unexpected request failure and shows the localized fallback. */
function reportRequestFailure(error: unknown, source: string, message: string) {
  return reportClientException(error, { source }).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        toast.error(message, { position: "bottom-center" });
      })
    )
  );
}

/** Shows one successful try-out action at the established screen position. */
function showSuccess(message: string) {
  return Effect.sync(() => {
    toast.success(message, { position: "bottom-center" });
  });
}
