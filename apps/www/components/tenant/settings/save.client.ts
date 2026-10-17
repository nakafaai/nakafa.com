"use client";

import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect, type Result } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** The copy of a save that the server refuses, which the Toaster shows in the reader's language. */
const SAVE_ERROR: ToastCopy = {
  description: "action-error.description",
  title: "action-error.title",
};

/**
 * Runs one save of the school from a browser event. A save that the server refuses
 * is reported, and the person sees the error message. An optimistic change steps
 * back by itself, because the server's answer replaces the store.
 */
export function saveSchool<A, E>(
  write: () => Promise<Result.Result<A, E>>,
  source: string,
  onSaved?: (answer: A) => void
) {
  return Effect.runPromise(
    Effect.tryPromise(write).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.matchEffect({
        onSuccess: (answer) =>
          Effect.sync(() => {
            onSaved?.(answer);
          }),
        onFailure: (error) =>
          reportClientException(error, { source }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                toast.error(SAVE_ERROR);
              })
            )
          ),
      })
    )
  );
}
