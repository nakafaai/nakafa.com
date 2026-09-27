import { Schema } from "effect";

/** Expected public read quota exhaustion. */
export class AgentRateLimitError extends Schema.TaggedError<AgentRateLimitError>()(
  "AgentRateLimitError",
  {
    retryAfterMs: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  }
) {}
