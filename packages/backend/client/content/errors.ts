import { ProtectedContentRuntimeRequestSchema as PredecessorContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import { ProtectedContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeFailureCodeSchema } from "@nakafa/aksara-contracts/runtime/result";
import { PublicContentRuntimeRequestSchema } from "@nakafa/aksara-contracts/runtime/spec";
import { NetworkRetryCodeSchema } from "@repo/backend/client/network";
import { Schema } from "effect";

const ContentRuntimeRequestSchema = Schema.Union([
  PublicContentRuntimeRequestSchema,
  ProtectedContentRuntimeRequestSchema,
  PredecessorContentRuntimeRequestSchema,
]);
/** The private Convex runtime exchange failed before verification. */
export class ContentTransportError extends Schema.TaggedError<ContentTransportError>()(
  "ContentTransportError",
  {
    networkCodes: Schema.optional(Schema.Array(NetworkRetryCodeSchema)),
    reason: Schema.Literals([
      "body",
      "content-length",
      "content-type",
      "fetch",
      "json-syntax",
      "request",
      "request-size",
      "response-contract",
      "response-size",
      "response-unmarked",
      "response-url",
      "status",
      "url",
    ]),
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
    status: Schema.Finite,
  }
) {}
/** A signed envelope failed cryptographic or identity verification. */
export class ContentRuntimeVerificationError extends Schema.TaggedError<ContentRuntimeVerificationError>()(
  "ContentRuntimeVerificationError",
  { cause: Schema.Unknown }
) {}
