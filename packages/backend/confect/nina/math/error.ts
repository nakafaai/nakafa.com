import { ToolChoiceViolationError } from "ai";
import { Schema } from "effect";

/** Language model generation failure raised by the math capability. */
export class MathGenerationError extends Schema.TaggedError<MathGenerationError>()(
  "MathGenerationError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Maps an unknown AI SDK failure into the math capability error contract. */
export function makeMathGenerationError(cause: unknown) {
  return new MathGenerationError({
    cause,
    message: "Math generation failed.",
  });
}

/**
 * A model that still called a tool in the last step, which the step rule allows none: the AI SDK refuses that step,
 * so the run ended at its step limit without writing its answer.
 */
export class MathStepLimitError extends Schema.TaggedError<MathStepLimitError>()(
  "MathStepLimitError",
  {}
) {}

/** Maps a failed math run: a tool call in the last step ended it at its step limit, and any other failure is a generation error. */
export function mathRunFailure(cause: unknown) {
  return ToolChoiceViolationError.isInstance(cause)
    ? new MathStepLimitError()
    : makeMathGenerationError(cause);
}
