import { expect, test } from "@playwright/test";
import { Effect } from "effect";

/**
 * The image route answers from the served build and its headers. The Start
 * server reads the logo from disk on each request, so the response proves the
 * logo ships with the function. The Vercel build output's file list is not
 * checked here.
 */
test("the image routes render and ship the logo they read", async ({
  request,
}) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        request.get("/en/og/image.png")
      );
      yield* Effect.sync(() => {
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toBe("image/png");
        // The CDN keeps a known route's image for an hour, as long as the
        // content it is rendered from, and the activation of a release purges
        // the tag.
        expect(response.headers()["cache-control"]).toContain("s-maxage=3600");
        expect(response.headers()["vercel-cache-tag"]).toBe("content-og");
      });
    })
  );
});
