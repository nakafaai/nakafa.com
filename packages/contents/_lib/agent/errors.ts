import { Schema } from "effect";

/** Input validation failure raised before reading Nakafa content. */
export class NakafaAgentInputError extends Schema.TaggedError<NakafaAgentInputError>()(
  "NakafaAgentInputError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}

/** Data loading failure raised while building the agent read model. */
export class NakafaAgentDataReadError extends Schema.TaggedError<NakafaAgentDataReadError>()(
  "NakafaAgentDataReadError",
  {
    cause: Schema.optional(Schema.String),
    message: Schema.String,
  }
) {}

/** Converts an unknown failure value into a stable diagnostic string. */
export function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
