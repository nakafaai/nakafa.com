import type { NinaTurn } from "@repo/ai/nina/contract/turn";
import type { LogContext } from "@repo/utilities/logging/types";
import { Effect } from "effect";

/** Formats AI SDK stream errors while preserving server-side diagnostics. */
export function formatNinaStreamError({
  error,
  logContext,
  turn,
}: {
  readonly error: unknown;
  readonly logContext: LogContext;
  readonly turn: NinaTurn;
}) {
  if (error instanceof Error) {
    if (error.message.includes("Rate limit")) {
      Effect.runFork(
        Effect.logWarning("Rate limit exceeded in Nina stream").pipe(
          Effect.annotateLogs(logContext)
        )
      );
      return turn.copy.rateLimitMessage;
    }

    return error.message;
  }

  Effect.runFork(
    Effect.logError("Unknown error in Nina stream").pipe(
      Effect.annotateLogs(logContext)
    )
  );
  return turn.copy.errorMessage;
}
