import { expect, type Page, type Route, test } from "@playwright/test";
import { Deferred, Effect, MutableList, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport } from "@/e2e/support/viewport";

const SESSION_READ = "**/api/auth/get-session*";

/** Every script of the page, held back so the page shows what its HTML and inline scripts draw. */
const SCRIPTS = /\/assets\/.*\.js/;

/** The member footer of the sidebar. */
const memberFooter = (page: Page) => page.locator('[data-account="member"]');

/** The live account button, which the row the browser kept is not. */
const liveAccountButton = (page: Page) =>
  page
    .locator(
      '[data-account="member"] [data-sidebar="menu-button"]:not([data-kept-account] *)'
    )
    .last();

/** Reads a CSS string, such as a pseudo element's content, whose escapes match JSON for a plain name. */
const readCssString = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.String)
);

/** The height a part of the page stands at, in whole pixels. */
function heightOf(page: Page, selector: string) {
  return page
    .locator(selector)
    .evaluate((element) => Math.round(element.getBoundingClientRect().height));
}

/** The account button of the member footer. */
const accountButton = (page: Page) =>
  page.locator('[data-account="member"] [data-sidebar="menu-button"]').last();

/**
 * Records, on every frame from the one where the member footer first stands in
 * the page, whether it shows an account button, as a list of the moments the
 * button appeared or left.
 */
async function watchAccountRow(page: Page) {
  await page.addInitScript(() => {
    const changes: boolean[] = [];
    Reflect.set(window, "nakafaAccountRow", changes);
    const look = () => {
      const footer = document.querySelector('[data-account="member"]');
      if (footer !== null) {
        const shown = [
          ...footer.querySelectorAll('[data-sidebar="menu-button"]'),
        ].some((button) => button.checkVisibility());
        if (changes.at(-1) !== shown) {
          changes.push(shown);
        }
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
    // The kept row shows from the footer's first frame, and the live row takes its place.
    expect(await accountRowChanges(page)).toStrictEqual([true]);
  });
  expect(yield* readCumulativeLayoutShift(page)).toBe(0);
});

/**
 * A learner opens a page, and the footer shows the account. The next page,
 * before any of its scripts run, already draws the row the browser kept: the
 * kept name, at the height the live row stands at. Once the scripts run and the
 * live row takes its place, the footer stands where it stood and nothing on the
 * page has moved.
 */
const verifyFirstFrame = Effect.fn("NakafaE2E.verifyFirstFrame")(function* (
  page: Page,
  baseURL: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  const live = yield* Effect.promise(async () => {
    await page.goto("/en/search");
    await expect(liveAccountButton(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.waitForLoadState("networkidle");
    return {
      height: await heightOf(page, '[data-account="member"]'),
      text: (await liveAccountButton(page).textContent()) ?? "",
    };
  });

  yield* Effect.promise(async () => {
    const held = MutableList.make<Route>();
    await page.route(SCRIPTS, (route) => {
      MutableList.append(held, route);
    });
    await page.goto("/en/search", { waitUntil: "domcontentloaded" });
    // The scripts were asked for and never answered: React has not run.
    await expect.poll(() => held.length).toBeGreaterThan(0);
    await expect(memberFooter(page)).toBeVisible();
    expect(await heightOf(page, '[data-account="member"]')).toBe(live.height);
    const keptName = await page
      .locator(
        '[data-kept-account] [data-sidebar="menu-button"] .truncate > span'
      )
      .evaluate((name) => getComputedStyle(name, "::before").content);
    expect(live.text).toContain(readCssString(keptName));

    for (const route of MutableList.toArray(held)) {
      await route.continue();
    }
    await page.unroute(SCRIPTS);
    await expect(liveAccountButton(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await page.waitForLoadState("networkidle");
    expect(await heightOf(page, '[data-account="member"]')).toBe(live.height);
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

  test("draws the kept row in the first frame, before the page's scripts run, at the live row's height", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyFirstFrame(page, origin))
        )
      )
    );
  });
});
