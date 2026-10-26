import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * A link to a page of the app moves the router inside the document: the page
 * keeps the same document, so a marker set on the window survives the move.
 * The public spelling of a locale-aware path shows in the address bar, and the
 * link of the page on screen marks itself as the current page.
 */
test("a same-app link moves inside the document and marks the current page", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.goto("/en/search", { waitUntil: "domcontentloaded" })
        );
        yield* Effect.promise(() =>
          page.evaluate(() => {
            Object.assign(window, { navigationMarker: "same-document" });
          })
        );

        // A press before React takes the link over loads the next page as a
        // document, as any link does, so the check presses a hydrated link.
        const curriculum = page
          .locator('a[href="/en/curriculum"]:visible')
          .first();
        yield* Effect.promise(() => waitUntilTakenOver(curriculum));
        yield* Effect.promise(() => curriculum.click());
        yield* Effect.promise(() => page.waitForURL("**/en/curriculum"));

        const marker = yield* Effect.promise(() =>
          page.evaluate(() => Reflect.get(window, "navigationMarker"))
        );
        yield* Effect.sync(() => expect(marker).toBe("same-document"));
        yield* Effect.promise(() =>
          expect(
            page.locator('a[href="/en/curriculum"]:visible').first()
          ).toHaveAttribute("aria-current", "page")
        );
      })
    )
  );
});

/** The address bar of a Bahasa Indonesia page shows the public spelling of its curriculum. */
test("a locale-aware link shows the public spelling of its route", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.goto("/id", { waitUntil: "domcontentloaded" })
        );

        const curriculum = page
          .locator('a[href="/id/kurikulum"]:visible')
          .first();
        yield* Effect.promise(() => waitUntilTakenOver(curriculum));
        yield* Effect.promise(() => curriculum.click());
        yield* Effect.promise(() => page.waitForURL("**/id/kurikulum"));

        const path = yield* Effect.sync(() => new URL(page.url()).pathname);
        yield* Effect.sync(() => expect(path).toBe("/id/kurikulum"));
      })
    )
  );
});
