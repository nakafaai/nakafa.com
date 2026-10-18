import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activateUntilVisible } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { SHEET_POPUP, VISIBLE_SIDEBAR_TRIGGER } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The page header a page draws for itself. */
const PAGE_HEADER = '[data-slot="page-header"]';

test("a phone shows one header row: the page's own, with the app sidebar's trigger", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.setViewportSize({ height: 844, width: 390 })
        );
        yield* Effect.promise(() => page.goto("/en/try-out"));

        const header = page.locator(PAGE_HEADER);
        const trigger = header.getByRole("button", { name: "Toggle Sidebar" });
        yield* Effect.promise(() =>
          expect(trigger).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          })
        );
        // The app's own bar, with its trigger and search, steps aside for the page header.
        yield* Effect.promise(() =>
          expect(page.locator(VISIBLE_SIDEBAR_TRIGGER)).toHaveCount(1)
        );
        yield* Effect.promise(() =>
          expect(
            page.getByRole("button", { name: "Search content..." })
          ).toBeHidden()
        );
        // The header sits at the top of the page, not under a bar that is gone.
        const box = yield* Effect.promise(() => header.boundingBox());
        yield* Effect.sync(() => expect(box?.y).toBe(0));

        // Its trigger opens the app's navigation, once the page has hydrated.
        yield* activateUntilVisible(
          trigger,
          page.locator(SHEET_POPUP),
          readinessTimeoutMilliseconds
        );
      })
    )
  );
});
