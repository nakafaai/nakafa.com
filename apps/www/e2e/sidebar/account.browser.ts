import { expect, type Page, test } from "@playwright/test";
import { Deferred, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport } from "@/e2e/support/viewport";

const SESSION_READ = "**/api/auth/get-session*";

/** The account button of the member footer. */
const accountButton = (page: Page) =>
  page.locator('[data-account="member"] [data-sidebar="menu-button"]').last();

/**
 * Records, on every frame from the first one, whether the member footer shows
 * the account button, as a list of the moments it appeared or left.
 */
async function watchAccountRow(page: Page) {
  await page.addInitScript(() => {
    const changes: boolean[] = [];
    Reflect.set(window, "nakafaAccountRow", changes);
    const look = () => {
      const shown =
        document.querySelector(
          '[data-account="member"] [data-sidebar="menu-button"]'
        ) !== null;
      if (changes.at(-1) !== shown) {
        changes.push(shown);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
}

/** Every moment the account row appeared (true) or left (false), in order. */
function accountRowChanges(page: Page) {
  return page.evaluate(() => Reflect.get(window, "nakafaAccountRow"));
}

/**
 * A learner opens a page, and the footer shows the account. On the next page
 * the session read is held back, as on a slow network: the footer draws the
 * account row it kept from the page before while the session is still on its
 * way, the live row takes its place without the row ever leaving, and nothing
 * on the page moves.
 */
const verifyKeptRow = Effect.fn("NakafaE2E.verifyKeptRow")(function* (
  page: Page,
  baseURL: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* Effect.promise(async () => {
    await page.goto("/en/search");
    await expect(accountButton(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });

  const released = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();
  const held = { count: 0 };
  yield* Effect.promise(() =>
    page.route(SESSION_READ, (route) => {
      held.count += 1;
      return Effect.runPromiseWith(services)(
        Deferred.await(released).pipe(
          Effect.andThen(() => Effect.promise(() => route.continue()))
        )
      );
    })
  );
  yield* Effect.promise(() => watchAccountRow(page));
  yield* Effect.promise(async () => {
    await page.goto("/en/search");
    await expect.poll(() => held.count).toBeGreaterThan(0);
    // The session is still on its way, and the kept row already shows.
    await expect(accountButton(page)).toBeVisible();
    await expect(accountButton(page)).toContainText("Free");
  });
  yield* Deferred.succeed(released, undefined);
  yield* Effect.promise(async () => {
    await page.waitForLoadState("networkidle");
    // The live row stands where the kept one stood, so the menu opens.
    await accountButton(page).click();
    await expect(
      page.getByRole("menuitem", { name: "Settings" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await accountRowChanges(page)).toStrictEqual([false, true]);
  });
  expect(yield* readCumulativeLayoutShift(page)).toBe(0);
});

test.describe("the signed-in sidebar footer", () => {
  test.use({
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("draws the account row it kept while the session is on its way, and never loses it", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyKeptRow(page, origin))
        )
      )
    );
  });
});
