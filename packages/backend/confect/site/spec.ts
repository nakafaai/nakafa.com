import { Schema } from "effect";
/** The primary site must be configured before building redirects or links. */
export class SiteConfigError extends Schema.TaggedError<SiteConfigError>()(
  "SiteConfigError",
  {
    code: Schema.Literal("SITE_URL_INVALID"),
    message: Schema.String,
  }
) {}

/** Reads the configured site only when a capability needs its URL or origin. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
