import { Schema } from "effect";

/** Language model generation failure raised by the Nakafa capability. */
export class NakafaGenerationError extends Schema.TaggedError<NakafaGenerationError>()(
  "NakafaGenerationError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Maps an unknown AI SDK failure into the Nakafa capability error contract. */
export function makeNakafaGenerationError(cause: unknown) {
  return new NakafaGenerationError({
    cause,
    message: "Nakafa generation failed.",
  });
}
