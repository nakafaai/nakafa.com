"use client";

import { captureException } from "@repo/analytics/posthog";
import type { PromptInputError } from "@repo/design-system/lib/prompt-input";
import { Effect } from "effect";

/** Runs one prompt submission at a React boundary and reports typed failures. */
export function runPromptInputProgram(
  program: Effect.Effect<void, PromptInputError>
) {
  return Effect.runFork(
    program.pipe(
      Effect.catchTags({
        PromptInputAttachmentConversionError: (error) =>
          Effect.sync(() => {
            captureException(error.cause, {
              operation: error.operation,
              source: "prompt-input-blob-conversion",
            });
          }),
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
