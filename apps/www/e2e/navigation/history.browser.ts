import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";

/**
 * Back and forward move through the router's history inside the same document:
 * each entry shows its own page again, and the window keeps its marker, so no
 * entry loads the whole application again.
 */
test("back and forward restore each page without reloading the document", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.goto("/en", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.promise(() =>
          page.evaluate(() => {
            Object.assign(window, { navigationMarker: "same-document" });
          })
        );

        const pricing = page.locator('a[href="/en/pricing"]:visible').first();
        yield* Effect.promise(() => pricing.click());
        yield* Effect.promise(() => page.waitForURL("**/en/pricing"));

        yield* Effect.promise(() => page.goBack());
        yield* Effect.promise(() => page.waitForURL("**/en"));
        const backPath = yield* Effect.sync(() => new URL(page.url()).pathname);
        yield* Effect.sync(() => expect(backPath).toBe("/en"));

        yield* Effect.promise(() => page.goForward());
        yield* Effect.promise(() => page.waitForURL("**/en/pricing"));

        const marker = yield* Effect.promise(() =>
          page.evaluate(() => Reflect.get(window, "navigationMarker"))
        );
        yield* Effect.sync(() => expect(marker).toBe("same-document"));
      })
    )
  );
});
