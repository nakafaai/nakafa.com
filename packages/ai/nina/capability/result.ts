import {
  EvidenceEnvelope,
  type LearningCapabilityName,
  LearningCapabilityResult,
} from "@repo/ai/nina/capability/spec";
import type { NinaReporter } from "@repo/ai/nina/runtime/report";
import { createPrompt } from "@repo/ai/prompt/utils";
import type { LogContext } from "@repo/utilities/logging/types";
import type { LanguageModelUsage } from "ai";
import type { Context, Effect as EffectType } from "effect";
import { Effect, Option, Schema } from "effect";

type AddUsage = (
  component: LearningCapabilityName,
  usage: LanguageModelUsage
) => EffectType.Effect<void>;

/** Tagged diagnostic used when a specialist throws a non-Error value. */
class SpecialistUnknownFailure extends Schema.TaggedError<SpecialistUnknownFailure>()(
  "SpecialistUnknownFailure",
  {
    message: Schema.String,
  }
) {}

/** Builds the common model-facing result for one LearningCapability execution. */
export function capabilityResult({
  capability,
  limitations,
  refs,
  status,
  text,
}: {
  readonly capability: LearningCapabilityName;
  readonly limitations?: readonly string[];
  readonly refs?: readonly string[];
  readonly status: EvidenceEnvelope["status"];
  readonly text: string;
}) {
  return LearningCapabilityResult.make({
    evidence: EvidenceEnvelope.make({
      capability,
      ...(limitations ? { limitations: [...limitations] } : {}),
      ...(refs ? { refs: [...refs] } : {}),
      status,
      summary: text,
    }),
    text,
  });
}

/** Converts completed LearningCapability evidence into the chat tool result shape. */
export function specialistSuccess({
  capability,
  text,
  usage,
}: {
  readonly capability: LearningCapabilityName;
  readonly text: string;
  readonly usage: LanguageModelUsage;
}) {
  return {
    ...capabilityResult({
      capability,
      status: "available",
      text,
    }),
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
    readonly component: LearningCapabilityName;
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
    readonly component: LearningCapabilityName;
    readonly error: unknown;
    readonly errorLocation: string;
    readonly reporter: Context.Tag.Service<typeof NinaReporter>;
  }) {
    const normalizedError = normalizeError(error);

    yield* Effect.annotateCurrentSpan("component", component);
    yield* Effect.annotateCurrentSpan("errorLocation", errorLocation);
    yield* reporter.report({ error: normalizedError, source: errorLocation });

    return {
      ...capabilityResult({
        capability: component,
        limitations: [String(normalizedError.message)],
        status: "failed",
        text: formatSpecialistFailure(component),
      }),
      usage: Option.none(),
    };
  }
);

/** Normalizes unknown thrown values into structured diagnostics for logs. */
function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new SpecialistUnknownFailure({ message: String(error) });
}

/** Builds a compact model-facing status for a failed LearningCapability call. */
function formatSpecialistFailure(component: LearningCapabilityName) {
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
