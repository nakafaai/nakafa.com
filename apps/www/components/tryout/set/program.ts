"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  StartAttemptArgs,
  StartAttemptResult,
} from "@repo/backend/convex/tryouts/start/spec";
import { Data, Effect } from "effect";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";

/** Expected client transport failure for a try-out action. */
class TryoutClientRequestError extends Data.TaggedError(
  "TryoutClientRequestError"
)<{
  readonly cause: unknown;
}> {}

interface StartAttemptProgramInput {
  readonly args: StartAttemptArgs;
  readonly failureMessage: string;
  readonly mutation: (args: StartAttemptArgs) => Promise<StartAttemptResult>;
  readonly onSuccess: (result: StartAttemptResult) => Effect.Effect<void>;
}

/** Runs the free start mutation and reports transport or source failures. */
export const startAttemptProgram = Effect.fn("tryout.startAttempt")(
  (input: StartAttemptProgramInput) =>
    Effect.tryPromise({
      try: () => input.mutation(input.args),
      catch: (cause) => new TryoutClientRequestError({ cause }),
    }).pipe(
      Effect.tap((result) => input.onSuccess(result)),
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
    }) => Promise<unknown>;
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
