import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { waitForLoadsSettled } from "@/e2e/support/quiet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { setHref } from "@/e2e/support/tryout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** An address that names a running attempt. */
const ATTEMPT_ADDRESS = /attemptId=/u;

/** The narrowest phone, a common phone, and a desktop. */
const WIDTHS = [320, 390, 1440] as const;

/** The first part of SNBT 2027 set 1, which a set that has just started goes on with. */
const FIRST_PART = "General Reasoning";

/**
 * The owner's card of 22 Nov 2026: the home shows the one try-out that wants the learner most. A set that
 * runs leads with the part it goes on with, its clock and Continue; on the narrowest phone Continue keeps
 * its icon and gives its word's room to the name. Every word stays on one line inside the row, and the
 * row opens the running attempt.
 */
test("a running try-out leads the home with its part, its clock and Continue, from 320 to 1440 px", async ({
  baseURL,
  page,
}) => {
  test.slow();
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(async () => {
          await finishOnboarding(page);
          await page.goto(setHref, { waitUntil: "commit" });
          const start = page.locator("main").getByRole("button", {
            exact: true,
            name: en.Tryouts.action["start-cta"],
          });
          await expect(start).toBeEnabled({
            timeout: readinessTimeoutMilliseconds,
          });
          await waitUntilTakenOver(start);
          await start.click();
          await page
            .getByRole("dialog")
            .getByRole("button", { exact: true, name: en.Tryouts["free-cta"] })
            .click();
          await page.waitForURL(ATTEMPT_ADDRESS);
          await waitForLoadsSettled(page);

          for (const width of WIDTHS) {
            await page.setViewportSize({ height: 900, width });
            await page.goto("/en/home");
            const row = page.locator('main a[href*="attemptId="]').first();
            await expect(row).toContainText(FIRST_PART, {
              timeout: readinessTimeoutMilliseconds,
            });
            const label = row.getByText(en.Common.continue, { exact: true });
            await expect(label).toBeAttached();
            const shape = await row.evaluate((link) => {
              const box = link.getBoundingClientRect();
              const name = link.querySelector("h3");
              const line = Number.parseFloat(
                getComputedStyle(name ?? link).lineHeight
              );
              return {
                inside: Array.from(link.querySelectorAll("*")).every((part) => {
                  const rect = part.getBoundingClientRect();
                  return (
                    rect.width === 0 ||
                    (rect.left >= box.left - 1 && rect.right <= box.right + 1)
                  );
                }),
                nameLines: (name?.getBoundingClientRect().height ?? 0) / line,
              };
            });
            expect(shape.inside, `${width}px: inside its row`).toBe(true);
            expect(shape.nameLines, `${width}px: one line`).toBeLessThan(1.5);
            // The narrowest card keeps Continue's icon alone; a wider one shows its word.
            if (width === 320) {
              await expect(label).toHaveCSS("position", "absolute");
            } else {
              await expect(label).toBeVisible();
            }
          }

          await page.locator('main a[href*="attemptId="]').first().click();
          await page.waitForURL(ATTEMPT_ADDRESS);
          await waitForLoadsSettled(page);

          // Navigating back to Home from inside the app reads Convex over the
          // browser's open client and sends no Worker server function request.
          await page.goto(setHref, { waitUntil: "commit" });
          await waitForLoadsSettled(page);
          const homeLink = page
            .getByRole("navigation", { name: en.Common.breadcrumb })
            .getByRole("link", { exact: true, name: en.Common.home });
          await expect(homeLink).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          let serverFnRequests: readonly string[] = [];
          const recordServerFn = (request: { url: () => string }) => {
            if (request.url().includes("/_serverFn/")) {
              serverFnRequests = Arr.append(serverFnRequests, request.url());
            }
          };
          page.on("request", recordServerFn);
          await homeLink.click();
          await page.waitForURL("**/en/home");
          await expect(
            page.locator('main a[href*="attemptId="]').first()
          ).toContainText(FIRST_PART, {
            timeout: readinessTimeoutMilliseconds,
          });
          page.off("request", recordServerFn);
          expect(serverFnRequests).toEqual([]);
        });
      })
    )
  );
});
