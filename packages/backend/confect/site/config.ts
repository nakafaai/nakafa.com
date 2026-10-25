import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { Array as Arr, Config, Effect, Option, Schema } from "effect";

const SiteUrl = Schema.URL.check(
  Schema.makeFilter(
    (url) => url.protocol === "https:" || url.protocol === "http:",
    {
      message: "Expected an absolute HTTP or HTTPS URL.",
    }
  )
);

/** The primary site must be configured before building redirects or links. */

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

/**
 * Reads the staging site when it shares this deployment. The dev deployment
 * serves local development at `SITE_URL` and staging.nakafa.com (ADR 0037), so
 * it sets `STAGING_SITE_URL`. Every other deployment leaves it unset.
 */
export const readStagingSiteUrl = Effect.fn("site.readStagingUrl")(
  function* () {
    return yield* Config.option(
      Config.schema(SiteUrl, "STAGING_SITE_URL")
    ).pipe(
      Effect.mapError(
        () =>
          new SiteConfigError({
            code: "SITE_URL_INVALID",
            message:
              "STAGING_SITE_URL must be an absolute HTTP or HTTPS URL when it is set.",
          })
      )
    );
  }
);

/** Every site that this deployment serves: the primary site first, then staging when it shares the deployment. */
export const readSiteUrls = Effect.fn("site.readUrls")(function* () {
  const primary = yield* readSiteUrl();
  const staging = yield* readStagingSiteUrl();
  return Arr.prepend(Option.toArray(staging), primary);
});
