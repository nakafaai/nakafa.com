import { Effect } from "effect";
import { captureServerExceptionSafely } from "@/lib/analytics/server";
import { getCachedSitemapEntries } from "@/lib/sitemap/entries";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";
import { SitemapPageNotFoundError } from "@/lib/sitemap/routes";
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

  if (!(pageId && getSitemapPageDescriptor(pageId))) {
    return createNotFoundResponse();
  }

  return Effect.runPromise(
    buildSitemapPageResponse(pageId).pipe(
      Effect.catch((error) =>
        error.cause instanceof SitemapPageNotFoundError
          ? Effect.succeed(createNotFoundResponse())
          : captureServerExceptionSafely(error.cause, {
              source: "sitemap-page",
            }).pipe(
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

/** Builds the canonical plain-text response for a missing sitemap page. */
function createNotFoundResponse() {
  return new Response("Not found", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    status: 404,
  });
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
    const entries = yield* Effect.tryPromise(() =>
      getCachedSitemapEntries({ pageId })
    );

    return new Response(buildSitemapUrlSetXml(entries), {
      headers: sitemapXmlHeaders,
    });
  }
);
