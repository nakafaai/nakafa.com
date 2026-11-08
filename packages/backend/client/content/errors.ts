import { Schema } from "effect";

/** A composed public response failed its contract before verification. */
export class ContentTransportError extends Schema.TaggedError<
  ContentTransportError,
  { readonly brand: unique symbol }
>()("ContentTransportError", {
  reason: Schema.Literals(["request", "response-contract"]),
}) {}
/** A signed envelope failed cryptographic or identity verification. */
export class ContentRuntimeVerificationError extends Schema.TaggedError<
  ContentRuntimeVerificationError,
  { readonly brand: unique symbol }
>()("ContentRuntimeVerificationError", {
  cause: Schema.Unknown,
}) {}
