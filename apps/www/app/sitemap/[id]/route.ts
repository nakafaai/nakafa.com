import { captureServerException } from "@repo/analytics/posthog/server";
import { Effect } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { buildSitemapUrlSetXml, sitemapXmlHeaders } from "@/lib/sitemap/xml";

const sitemapPageError = "Internal Server Error";
const sitemapPageExtension = ".xml";

/** Serves one bounded sitemap page from materialized Convex route rows. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const pageId = parseSitemapPageId(id);

  if (!pageId) {
    return new Response("Not found", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 404,
    });
  }

  return Effect.runPromise(
    buildSitemapPageResponse(pageId).pipe(
      Effect.catchAll((error) =>
        reportSitemapRouteError(error, "sitemap-page").pipe(
          Effect.as(
            new Response(sitemapPageError, {
              headers: { "Content-Type": "text/plain; charset=utf-8" },
              status: 500,
            })
          )
        )
      )
    )
  );
}

/** Extracts the materialized page id from a `.xml` sitemap route segment. */
function parseSitemapPageId(segment: string) {
  if (!segment.endsWith(sitemapPageExtension)) {
    return null;
  }

  const pageId = segment.slice(0, -sitemapPageExtension.length);
  if (!pageId) {
    return null;
  }

  return pageId;
}

/** Builds one sitemap page response from bounded sitemap entries. */
const buildSitemapPageResponse = Effect.fn("www.sitemap.page.response")(
  function* (pageId: string) {
    const entries = yield* getSitemapEntries({
      pageId,
      reportError: (error, context) =>
        captureServerException(error, undefined, context),
    });

    return new Response(buildSitemapUrlSetXml(entries), {
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
