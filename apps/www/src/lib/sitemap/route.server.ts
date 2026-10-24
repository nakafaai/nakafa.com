import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Cause, Effect, Option, Schema } from "effect";
import { captureServerExceptionSafely } from "@/lib/analytics/exception.server";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";
import {
  buildSitemapIndexXml,
  buildSitemapUrlSetXml,
  sitemapXmlHeaders,
} from "@/lib/sitemap/xml";

const SITEMAP_ERROR = "Internal Server Error";
const SITEMAP_PAGE_EXTENSION = ".xml";
const PLAIN_TEXT = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * Reports one failed sitemap, then answers the plain-text 500 without its
 * details. Defects are reported too, and an interrupt keeps propagating because
 * it is not a failed sitemap.
 */
function reportSitemapFailure<E>(
  source: string,
  cause: Cause.Cause<E>
): Effect.Effect<Response, E> {
  if (Cause.hasInterruptsOnly(cause)) {
    return Effect.failCause(cause);
  }
  return captureServerExceptionSafely(Cause.squash(cause), { source }).pipe(
    Effect.as(new Response(SITEMAP_ERROR, { headers: PLAIN_TEXT, status: 500 }))
  );
}

/** Answers the plain-text 404 of a sitemap page that does not exist. */
function createNotFoundResponse() {
  return new Response("Not found", { headers: PLAIN_TEXT, status: 404 });
}

/** Builds the sitemap index response from materialized page descriptors. */
const buildSitemapIndexResponse = Effect.fn("www.sitemap.index.response")(
  function* () {
    const descriptors = yield* readSitemapPageDescriptors();
    const urls = Arr.map(
      descriptors,
      (descriptor) => `${SITE_ORIGIN}/sitemap/${descriptor.id}.xml`
    );

    return new Response(buildSitemapIndexXml(urls), {
      headers: sitemapXmlHeaders,
    });
  }
);

/** Serves the conventional sitemap index that points at bounded sitemap pages. */
export const serveSitemapIndex = Effect.fn("www.sitemap.index.serve")(() =>
  buildSitemapIndexResponse().pipe(
    Effect.catchCause((cause) => reportSitemapFailure("sitemap-index", cause))
  )
);

/** Extracts the materialized page id from a `.xml` sitemap route segment. */
function parseSitemapPageId(segment: string): Option.Option<string> {
  if (!segment.endsWith(SITEMAP_PAGE_EXTENSION)) {
    return Option.none();
  }

  const pageId = segment.slice(0, -SITEMAP_PAGE_EXTENSION.length);
  return pageId ? Option.some(pageId) : Option.none();
}

/**
 * Builds one sitemap page response from bounded sitemap entries.
 *
 * The id comes from the request and its format admits any page number, so it is
 * checked against the pages that the release lists in its sitemap index before
 * any entries are read for it. An id outside the list is answered with a plain
 * 404, and its page entries are never read.
 */
const buildSitemapPageResponse = Effect.fn("www.sitemap.page.response")(
  function* (pageId: string) {
    const descriptors = yield* readSitemapPageDescriptors();
    if (!Arr.some(descriptors, ({ id }) => id === pageId)) {
      return createNotFoundResponse();
    }
    return yield* getSitemapEntries({ pageId }).pipe(
      Effect.map(
        (entries) =>
          new Response(buildSitemapUrlSetXml(entries), {
            headers: sitemapXmlHeaders,
          })
      ),
      Effect.catchTag("SitemapPageNotFoundError", () =>
        Effect.succeed(createNotFoundResponse())
      )
    );
  }
);

/** The name of one sitemap page, as the route segment spells it. */
const SitemapPageParamsSchema = Schema.Struct({ id: Schema.String });

/** Serves one bounded sitemap page from materialized Convex route rows. */
export const serveSitemapPage = Effect.fn("www.sitemap.page.serve")(function* ({
  params,
}: {
  readonly params: typeof SitemapPageParamsSchema.Type;
}) {
  const pageId = parseSitemapPageId(params.id);
  if (
    Option.isNone(pageId) ||
    Option.isNone(getSitemapPageDescriptor(pageId.value))
  ) {
    return createNotFoundResponse();
  }
  return yield* buildSitemapPageResponse(pageId.value).pipe(
    Effect.catchCause((cause) => reportSitemapFailure("sitemap-page", cause))
  );
});
