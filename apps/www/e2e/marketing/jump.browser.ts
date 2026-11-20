import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForAnimations } from "@/e2e/support/quiet";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The report cards section of the School landing, which the header's School section opens. */
const SCHOOL_REPORTS = /\/en\/school#reports$/u;

/** How far a jumped-to section may lie from the header's bottom edge, for sub-pixel rounding. */
const TOLERANCE = 1;

/** How far the top of the report cards section lies from the header's bottom edge, either way. */
function readReportsOffset() {
  const header = document.querySelector("header");
  const section = document.querySelector("#reports");
  if (header === null || section === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(
    section.getBoundingClientRect().top - header.getBoundingClientRect().bottom
  );
}

/** Waits until the report cards section lies right under the header. */
const expectReportsUnderHeader = Effect.fn(
  "NakafaE2E.expectReportsUnderHeader"
)(function* (page: Page) {
  yield* Effect.promise(() =>
    expect
      .poll(() => page.evaluate(readReportsOffset))
      .toBeLessThanOrEqual(TOLERANCE)
  );
});

/**
 * A School feature's link in the header's sections lands its section right under
 * the header, whether the reader is on the School landing or comes from the main
 * one. The section lies far under the first screen, where the browser has not
 * laid it out yet, so the jump proves the page scrolls to a part it skips.
 */
test("a School feature's link in the header's sections brings its section right under the header, from the School landing and from the main one", async ({
  page,
}) => {
  await page.setViewportSize(viewportSize(desktopViewport));
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.forEach(
        ["/en/school", "/en"],
        (start) =>
          Effect.gen(function* () {
            yield* loadMarketingPage(page, start);
            yield* Effect.promise(() =>
              page
                .locator("header")
                .getByRole("button", { name: "School" })
                .click()
            );
            // A press made while the popup still scales in can land on another of its links.
            const popup = page.locator(
              '[data-slot="navigation-menu-viewport"]'
            );
            yield* Effect.promise(() => expect(popup).toBeVisible());
            yield* Effect.promise(() => waitForAnimations(popup));
            yield* Effect.promise(() =>
              popup.getByRole("link", { name: "Report cards" }).click()
            );
            yield* Effect.promise(() => expect(page).toHaveURL(SCHOOL_REPORTS));
            yield* expectReportsUnderHeader(page);
          }),
        { discard: true }
      )
    )
  );
});

/**
 * A reader who opens the address of a School feature's section lands on it right
 * under the header, and the page that takes over moves nothing after that.
 */
test("the address of a School feature's section opens the landing with the section right under the header", async ({
  page,
}) => {
  await page.setViewportSize(viewportSize(desktopViewport));
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          page.goto("/en/school#reports", { waitUntil: "load" })
        );
        yield* expectReportsUnderHeader(page);
        yield* Effect.promise(() =>
          waitUntilTakenOver(page.locator("main").first())
        );
        yield* expectReportsUnderHeader(page);
      })
    )
  );
});
