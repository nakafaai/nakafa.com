import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { Schema } from "effect";

/** Authenticated MDX code could not produce its expected React module. */
export class ContentExecutionError extends Schema.TaggedError<ContentExecutionError>()(
  "ContentExecutionError",
  {
    contentKey: ContentKeySchema,
    stage: Schema.Literal("evaluate", "module"),
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
