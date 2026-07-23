import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { ContentRuntimeFailureCodeSchema } from "@nakafa/aksara-contracts/runtime/spec";
import { Schema } from "effect";

/** Authenticated MDX code could not produce its expected React module. */
export class ContentExecutionError extends Schema.TaggedError<ContentExecutionError>()(
  "ContentExecutionError",
  {
    contentKey: ContentKeySchema,
    stage: Schema.Literal("evaluate", "module"),
  }
) {}

/** The private Convex runtime exchange failed before contract verification. */
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

/** A known Aksara-owned route has no active published artifact. */
export class PublishedContentMissingError extends Schema.TaggedError<PublishedContentMissingError>()(
  "PublishedContentMissingError",
  {
    locale: ContentLocaleSchema,
    publicPath: Schema.String,
  }
) {}

/** Convex rejected a private runtime request with a sanitized typed code. */
export class PublishedContentFailureError extends Schema.TaggedError<PublishedContentFailureError>()(
  "PublishedContentFailureError",
  {
    code: ContentRuntimeFailureCodeSchema,
    status: Schema.Number,
  }
) {}

/** A verified projection cannot satisfy Nakafa's current material route shell. */
export class PublishedProjectionError extends Schema.TaggedError<PublishedProjectionError>()(
  "PublishedProjectionError",
  {
    locale: ContentLocaleSchema,
    publicPath: Schema.String,
  }
) {}

/** A selected published route has no matching physical renderer implementation. */
export class PublishedRendererMissingError extends Schema.TaggedError<PublishedRendererMissingError>()(
  "PublishedRendererMissingError",
  {
    rendererDomain: RendererDomainSchema,
  }
) {}
