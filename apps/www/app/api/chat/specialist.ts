import { createPrompt } from "@repo/ai/prompt/utils";
import type { ToolName } from "@repo/ai/schema/tools";
import type { LogContext } from "@repo/utilities/logging/types";
import type { LanguageModelUsage } from "ai";
import { Effect, Option } from "effect";

type AddUsage = (
  component: ToolName,
  usage: LanguageModelUsage
) => Effect.Effect<void>;

export interface SpecialistResult {
  text: string;
  usage: Option.Option<LanguageModelUsage>;
}

interface RecoverSpecialistFailureParams {
  component: ToolName;
  error: unknown;
  errorLocation: string;
  reportError: (error: unknown, source: string) => void;
}

interface RecordSpecialistUsageParams {
  addUsage: AddUsage;
  component: ToolName;
  logContext: LogContext;
  result: SpecialistResult;
}

/**
 * Converts a completed specialist response into the chat tool result shape.
 */
export function specialistSuccess({
  text,
  usage,
}: {
  text: string;
  usage: LanguageModelUsage;
}): SpecialistResult {
  return {
    text,
    usage: Option.some(usage),
  };
}

/**
 * Records specialist usage only when the model returned real usage data.
 */
export const recordSpecialistUsage = Effect.fn("chat.specialist.recordUsage")(
  function* ({
    addUsage,
    component,
    logContext,
    result,
  }: RecordSpecialistUsageParams) {
    yield* Effect.annotateCurrentSpan("component", component);

    if (Option.isNone(result.usage)) {
      yield* Effect.logWarning("Specialist usage unavailable").pipe(
        Effect.annotateLogs({
          ...logContext,
          component,
          type: "specialist_usage",
          usageAvailable: false,
        })
      );
      return;
    }

    yield* addUsage(component, result.usage.value);
  }
);

/**
 * Turns a specialist failure into model-facing recovery evidence.
 *
 * The returned text is a tool result for the orchestrator, not final user copy.
 *
 * @see https://effect.website/docs/observability/tracing/
 * @see https://effect.website/docs/observability/logging/
 */
export const recoverSpecialistFailure = Effect.fn(
  "chat.specialist.recoverFailure"
)(function* ({
  component,
  error,
  errorLocation,
  reportError,
}: RecoverSpecialistFailureParams) {
  const normalizedError = normalizeError(error);

  yield* Effect.annotateCurrentSpan("component", component);
  yield* Effect.annotateCurrentSpan("errorLocation", errorLocation);

  reportError(normalizedError, errorLocation);

  return {
    text: formatSpecialistFailure(component),
    usage: Option.none(),
  };
});

/** Normalizes unknown thrown values into Error objects for structured logs. */
function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/**
 * Builds a compact model-facing status for a failed specialist call.
 */
function formatSpecialistFailure(component: ToolName) {
  return createPrompt({
    taskContext: [
      "# Specialist Status",
      "",
      `- Specialist: ${component}`,
      "- Status: error",
      "- Evidence returned: none",
      "- Usage returned: none",
      "",
      "# Final Answer Constraint",
      "",
      "Use only evidence already present in this conversation.",
      "Do not invent facts from the failed specialist.",
      "Do not copy this status block into the final answer.",
    ].join("\n"),
  });
}
