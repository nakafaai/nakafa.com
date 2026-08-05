import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Schema } from "effect";

/** Authenticated MDX code could not produce its expected React module. */
export class ContentExecutionError extends Schema.TaggedError<ContentExecutionError>()(
  "ContentExecutionError",
  {
    contentKey: ContentKeySchema,
    stage: Schema.Literal("evaluate", "module"),
  }
) {}

/** Published content was selected without its private runtime credential. */
export class ContentRuntimeConfigurationError extends Schema.TaggedError<ContentRuntimeConfigurationError>()(
  "ContentRuntimeConfigurationError",
  {
    key: Schema.Literal("CONTENT_RUNTIME_TOKEN"),
  }
) {}

/** A verified projection cannot satisfy its requested public surface. */
export class PublishedProjectionError extends Schema.TaggedError<PublishedProjectionError>()(
  "PublishedProjectionError",
  {
    locale: ContentLocaleSchema,
    publicPath: Schema.String,
  }
) {}

/** Public route identity attached to a malformed signed projection. */
export type PublishedProjectionIdentity = Pick<
  PublishedProjectionError,
  "locale" | "publicPath"
>;

/** Two release-bound reads observed different active publication identities. */
export class PublishedReleaseMismatchError extends Schema.TaggedError<PublishedReleaseMismatchError>()(
  "PublishedReleaseMismatchError",
  {
    actualReleaseId: Schema.NullOr(ReleaseIdSchema),
    expectedReleaseId: Schema.NullOr(ReleaseIdSchema),
  }
) {}
