import { ProtectedContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeFailureCodeSchema } from "@nakafa/aksara-contracts/runtime/result";
import { PublicContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/spec";
import { Schema } from "effect";

const ContentRuntimeRequestSchema = Schema.Union(
  PublicContentRuntimeRequestSchema,
  ProtectedContentRuntimeRequestSchema
);

/** The private Convex runtime exchange failed before verification. */
export class ContentTransportError extends Schema.TaggedError<ContentTransportError>()(
  "ContentTransportError",
  {
    reason: Schema.Literal(
      "body",
      "content-length",
      "content-type",
      "fetch",
      "json",
      "request",
      "request-size",
      "response-size",
      "response-url",
      "status",
      "url"
    ),
  }
) {}

/** One exact runtime request has no active or retained signed artifact. */
export class ContentRuntimeMissingError extends Schema.TaggedError<ContentRuntimeMissingError>()(
  "ContentRuntimeMissingError",
  { request: ContentRuntimeRequestSchema }
) {}

/** Convex rejected a signed runtime request with a sanitized code. */
export class ContentRuntimeFailureError extends Schema.TaggedError<ContentRuntimeFailureError>()(
  "ContentRuntimeFailureError",
  {
    code: ContentRuntimeFailureCodeSchema,
    status: Schema.Number,
  }
) {}

/** A signed envelope failed cryptographic or identity verification. */
export class ContentRuntimeVerificationError extends Schema.TaggedError<ContentRuntimeVerificationError>()(
  "ContentRuntimeVerificationError",
  { cause: Schema.Unknown }
) {}
