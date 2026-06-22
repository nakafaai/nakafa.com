import type { NinaReporter } from "@repo/ai/nina/runtime/report";
import { createPrompt } from "@repo/ai/prompt/utils";
import type { ToolName } from "@repo/ai/schema/tools";
import type { LogContext } from "@repo/utilities/logging/types";
import type { LanguageModelUsage } from "ai";
import type { Context, Effect as EffectType } from "effect";
import { Effect, Option } from "effect";

type AddUsage = (
  component: ToolName,
  usage: LanguageModelUsage
) => EffectType.Effect<void>;

/** Converts a completed specialist response into the chat tool result shape. */
export function specialistSuccess({
  text,
  usage,
}: {
  readonly text: string;
  readonly usage: LanguageModelUsage;
}) {
  return {
    text,
    usage: Option.some(usage),
  };
}

/** Records specialist usage only when the model returned real usage data. */
export const recordSpecialistUsage = Effect.fn("nina.specialist.usage")(
  function* ({
    addUsage,
    component,
    logContext,
    result,
  }: {
    readonly addUsage: AddUsage;
    readonly component: ToolName;
    readonly logContext: LogContext;
    readonly result: ReturnType<typeof specialistSuccess>;
  }) {
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

/** Turns a specialist failure into model-facing recovery evidence. */
export const recoverSpecialistFailure = Effect.fn("nina.specialist.recover")(
  function* ({
    component,
    error,
    errorLocation,
    reporter,
  }: {
    readonly component: ToolName;
    readonly error: unknown;
    readonly errorLocation: string;
    readonly reporter: Context.Tag.Service<typeof NinaReporter>;
  }) {
    const normalizedError = normalizeError(error);

    yield* Effect.annotateCurrentSpan("component", component);
    yield* Effect.annotateCurrentSpan("errorLocation", errorLocation);
    yield* reporter.report({ error: normalizedError, source: errorLocation });

    return {
      text: formatSpecialistFailure(component),
      usage: Option.none(),
    };
  }
);

/** Normalizes unknown thrown values into Error objects for structured logs. */
function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/** Builds a compact model-facing status for a failed specialist call. */
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
