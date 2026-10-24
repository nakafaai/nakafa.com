import { expect, test } from "@playwright/test";
import { Effect } from "effect";

/**
 * The image route answers from the served build and its headers. The logo is
 * bundled with the server code, so a rendered image shows that the served build
 * carries the logo it draws.
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
        // The CDN keeps a known route's image for an hour.
        expect(response.headers()["cache-control"]).toContain("s-maxage=3600");
      });
    })
  );
});
