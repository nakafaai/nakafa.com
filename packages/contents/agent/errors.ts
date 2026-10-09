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
