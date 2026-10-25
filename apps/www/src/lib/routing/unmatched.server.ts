import { env } from "cloudflare:workers";
import { Effect } from "effect";

/**
 * Answers an unmatched address with the static not-found page of the release. The
 * platform serves that page for every path without an asset, because the assets
 * answer with the 404 page (`notFoundHandling`). The Worker only copies the status
 * of the page, and the page headers that the server entry adds mark it `noindex`.
 */
export const answerUnmatchedRequest = Effect.fn("www.routing.unmatched")(
  function* (request: Request) {
    const page = yield* Effect.promise(() => env.ASSETS.fetch(request));
    return new Response(page.body, { headers: page.headers, status: 404 });
  }
);
