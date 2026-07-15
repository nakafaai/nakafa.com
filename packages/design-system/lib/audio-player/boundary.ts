"use client";

import { captureException } from "@repo/analytics/posthog";
import type { AudioPlayerError } from "@repo/design-system/lib/audio-player/runtime";
import { Effect } from "effect";

/** Runs one player command at a React or browser boundary and reports failures. */
export function runAudioPlayerProgram(
  program: Effect.Effect<void, AudioPlayerError>,
  source: string
) {
  return Effect.runFork(
    program.pipe(
      Effect.catchTags({
        AudioPlayerOperationError: (error) =>
          Effect.sync(() => {
            captureException(error.cause, {
              operation: error.operation,
              source,
            });
          }),
        InvalidAudioPlayerSourceError: (error) =>
          Effect.sync(() => {
            captureException(error, {
              itemId: error.itemId,
              operation: "prepare-item",
              source,
            });
          }),
      })
    )
  );
}
