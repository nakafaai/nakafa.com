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
