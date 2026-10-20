import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "../support/consent";
import { activateUntilVisible } from "../support/input";
import { withObservedPageErrors } from "../support/observe";
import { VISIBLE_SIDEBAR_TRIGGER } from "../support/selector";
import { readinessTimeoutMilliseconds } from "../support/timeout";

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
          expect(page.locator(VISIBLE_SIDEBAR_TRIGGER)).toHaveCount(1, {
            timeout: readinessTimeoutMilliseconds,
          })
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
          page.getByRole("dialog", { name: "Sidebar" }),
          readinessTimeoutMilliseconds
        );
      })
    )
  );
});

test("a phone shows the app's bar again on a page without a header of its own, after one that had it", async ({
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
        yield* Effect.promise(() =>
          expect(header).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );

        // The Quran draws no page header, while the router keeps the try-out page in
        // the document, hidden: its header must not hide the app's bar. Both pages
        // are public, so the visit needs no account (Home sends a visitor without
        // one to sign in).
        const quran = yield* activateUntilVisible(
          header.getByRole("button", { name: "Toggle Sidebar" }),
          page
            .locator('[data-sidebar="sidebar"]:visible')
            .getByRole("link", { exact: true, name: "Quran" }),
          readinessTimeoutMilliseconds
        );
        yield* Effect.promise(async () => {
          await quran.click();
          await page.waitForURL("**/en/quran");
        });
        yield* Effect.promise(() =>
          expect(
            page.getByRole("button", { name: "Search content..." })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
        );
        yield* Effect.promise(() =>
          expect(page.locator(VISIBLE_SIDEBAR_TRIGGER)).toHaveCount(1, {
            timeout: readinessTimeoutMilliseconds,
          })
        );
      })
    )
  );
});
