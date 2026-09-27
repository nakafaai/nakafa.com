"use client";

import { captureException } from "@repo/analytics/posthog/browser";
import type { PromptInputError } from "@repo/design-system/lib/prompt-input/submission";
import { Effect } from "effect";

/** Runs one prompt submission at a React boundary and reports typed failures. */
export function runPromptInputProgram(
  program: Effect.Effect<void, PromptInputError>
) {
  return Effect.runFork(
    program.pipe(
      Effect.catchTags({
        PromptInputCompletionError: (error) =>
          Effect.sync(() => {
            captureException(error.cause, {
              source: "prompt-input-completion",
            });
          }),
        PromptInputSubmitError: (error) =>
          Effect.sync(() => {
            captureException(error.cause, {
              source: "prompt-input-submit",
            });
          }),
      })
    )
  );
}
