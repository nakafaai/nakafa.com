import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { ContentRuntimeFailureCodeSchema } from "@nakafa/aksara-contracts/runtime/spec";
import { Schema } from "effect";

/** The private Convex runtime exchange failed before verification. */
export class ContentTransportError extends Schema.TaggedError<ContentTransportError>()(
  "ContentTransportError",
  {
    reason: Schema.Literal(
      "body",
      "content-length",
      "content-type",
      "delivery",
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

/** A requested public route has no active signed artifact. */
export class PublicContentMissingError extends Schema.TaggedError<PublicContentMissingError>()(
  "PublicContentMissingError",
  {
    locale: ContentLocaleSchema,
    publicPath: Schema.String,
  }
) {}

/** Convex rejected a signed runtime request with a sanitized code. */
export class PublicContentFailureError extends Schema.TaggedError<PublicContentFailureError>()(
  "PublicContentFailureError",
  {
    code: ContentRuntimeFailureCodeSchema,
    status: Schema.Number,
  }
) {}

/** A signed envelope failed cryptographic or identity verification. */
export class PublicContentVerificationError extends Schema.TaggedError<PublicContentVerificationError>()(
  "PublicContentVerificationError",
  {
    cause: Schema.Unknown,
  }
) {}

/** Convex rejected one private try-out content request. */
export class TryoutContentFailureError extends Schema.TaggedError<TryoutContentFailureError>()(
  "TryoutContentFailureError",
  {
    code: Schema.Literal(
      "TRYOUT_CONTENT_INTERNAL",
      "TRYOUT_CONTENT_INVALID",
      "TRYOUT_CONTENT_UNAUTHORIZED"
    ),
    status: Schema.Number,
  }
) {}
