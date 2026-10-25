import { env } from "cloudflare:workers";
import { Effect } from "effect";

/**
 * Answers an unmatched address with the static not-found page of the release. The
 * platform serves that page for every path without an asset, because the assets
 * answer with the 404 page (`notFoundHandling`). The Worker copies the page's
 * headers, which carry the security policy, then sets the type and the cache of
 * an HTML answer. A path rule of the page's address (a sitemap's XML type, an
 * image's cache lifetime) describes a file that the address does not name, and a
 * not-found answer must not be cached for a file that may appear later.
 */
export const answerUnmatchedRequest = Effect.fn("www.routing.unmatched")(
  function* (request: Request) {
    const page = yield* Effect.promise(() => env.ASSETS.fetch(request));
    const headers = new Headers(page.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(page.body, { headers, status: 404 });
  }
);
