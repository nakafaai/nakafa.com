import { Schema } from "effect";

/** A composed public response failed its contract before verification. */
export class ContentTransportError extends Schema.TaggedError<ContentTransportError>()(
  "ContentTransportError",
  {
    reason: Schema.Literals(["request", "response-contract"]),
  }
) {}
/** A signed envelope failed cryptographic or identity verification. */
export class ContentRuntimeVerificationError extends Schema.TaggedError<ContentRuntimeVerificationError>()(
  "ContentRuntimeVerificationError",
  {
    cause: Schema.Unknown,
  }
) {}
