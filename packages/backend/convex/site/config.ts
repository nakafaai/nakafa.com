import { Config, Effect, Schema } from "effect";

const SiteUrl = Schema.URL.check(
  Schema.makeFilter(
    (url) => url.protocol === "https:" || url.protocol === "http:",
    { message: "Expected an absolute HTTP or HTTPS URL." }
  )
);

/** The primary site must be configured before building redirects or links. */
export class SiteConfigError extends Schema.TaggedError<SiteConfigError>()(
  "SiteConfigError",
  {
    code: Schema.Literal("SITE_URL_INVALID"),
    message: Schema.String,
  }
) {}

/** Reads the configured site only when a capability needs its URL or origin. */
export const readSiteUrl = Effect.fn("site.readUrl")(function* () {
  return yield* Config.schema(SiteUrl, "SITE_URL").pipe(
    Effect.mapError(
      () =>
        new SiteConfigError({
          code: "SITE_URL_INVALID",
          message:
            "SITE_URL must be configured as an absolute HTTP or HTTPS URL.",
        })
    )
  );
});
