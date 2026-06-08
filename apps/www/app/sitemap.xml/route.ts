import { captureServerException } from "@repo/analytics/posthog/server";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Effect } from "effect";
import { getSitemapPageDescriptorsEffect } from "@/lib/sitemap/routes";
import { buildSitemapIndexXml, sitemapXmlHeaders } from "@/lib/sitemap/xml";

const sitemapIndexError = "Internal Server Error";
const canonicalSitemapOrigin = `https://${MAIN_DOMAIN}`;

/** Serves the conventional sitemap index that points at bounded sitemap pages. */
export function GET() {
  return Effect.runPromise(
    buildSitemapIndexResponse().pipe(
      Effect.catchAll((error) =>
        reportSitemapRouteError(error, "sitemap-index").pipe(
          Effect.as(
            new Response(sitemapIndexError, {
              headers: { "Content-Type": "text/plain; charset=utf-8" },
              status: 500,
            })
          )
        )
      )
    )
  );
}

/** Builds the sitemap index response from materialized page descriptors. */
const buildSitemapIndexResponse = Effect.fn("www.sitemap.index.response")(
  function* () {
    const descriptors = yield* getSitemapPageDescriptorsEffect();
    const urls = descriptors.map(
      (descriptor) => `${canonicalSitemapOrigin}/sitemap/${descriptor.id}.xml`
    );

    return new Response(buildSitemapIndexXml(urls), {
      headers: sitemapXmlHeaders,
    });
  }
);

/** Reports sitemap route failures without exposing implementation details. */
function reportSitemapRouteError(error: unknown, source: string) {
  return Effect.tryPromise({
    try: () => captureServerException(error, undefined, { source }),
    catch: (cause) => cause,
  }).pipe(Effect.ignore);
}
