import { expect, type Page, type Route, test } from "@playwright/test";
import { Deferred, Effect, MutableList, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { createSchool, inviteLearner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

const SESSION_READ = "**/api/auth/get-session*";

/** Every script of the page, held back so the page shows what its HTML and inline scripts draw. */
const SCRIPTS = /\/assets\/.*\.js/u;

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
    // The plan's two words sit under a `.truncate` too, so the name is the
    // span that is not a plan part.
    const keptName = await page
      .locator(
        '[data-kept-account] [data-sidebar="menu-button"] .truncate > span:not([data-kept-plan-part])'
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

/** The key under which the browser keeps the schools the account menu showed. */
const KEPT_SCHOOLS = "nakafa-schools";

/** The name of the toggle that opens the phone sidebar. */
const SIDEBAR_TOGGLE = "Toggle Sidebar";

/**
 * Records, on every frame from the one the account menu first shows, whether it
 * holds the school, as a list of the moments the school appeared or left.
 */
async function watchSchoolRow(page: Page, name: string) {
  await page.addInitScript((school) => {
    const changes: boolean[] = [];
    Reflect.set(window, "nakafaSchoolRow", changes);
    const look = () => {
      const menu = [...document.querySelectorAll('[role="menu"]')].find(
        (candidate) => candidate.checkVisibility()
      );
      if (menu !== undefined) {
        const shown = (menu.textContent ?? "").includes(school);
        if (changes.at(-1) !== shown) {
          changes.push(shown);
        }
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, name);
}

/** Opens the account menu of the footer that shows at this width. */
async function openAccountMenu(page: Page, phone: boolean) {
  if (phone) {
    await page.getByRole("button", { name: SIDEBAR_TOGGLE }).first().click();
  }
  const footer = phone
    ? page.locator('[data-mobile="true"] [data-account="member"]')
    : memberFooter(page);
  const button = footer
    .locator('[data-sidebar="menu-button"]:not([data-kept-account] *)')
    .last();
  await expect(button).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await button.click();
}

/**
 * A learner of a school opens a page, and the browser keeps the account's schools.
 * On the next page the account menu holds the school from the first frame it
 * shows, on the phone sheet too, which mounts its own menu as it opens, and the
 * school never leaves it while the live list answers.
 */
const verifySchoolsFirstFrame = Effect.fn("NakafaE2E.verifySchoolsFirstFrame")(
  function* (page: Page, baseURL: string, phone: boolean) {
    const school = yield* createSchool();
    yield* seedAnalyticsConsent(page, "denied");
    yield* inviteLearner({
      address: `learner-${school.slug}@acceptance.example.test`,
      baseURL,
      context: page.context(),
      slug: school.slug,
    });
    yield* Effect.promise(async () => {
      await page.goto("/en/search");
      await expect
        .poll(
          () =>
            page.evaluate(
              (key) => window.localStorage.getItem(key) ?? "",
              KEPT_SCHOOLS
            ),
          { timeout: readinessTimeoutMilliseconds }
        )
        .toContain(school.name);
      await watchSchoolRow(page, school.name);
      await page.goto("/en/search");
      await openAccountMenu(page, phone);
      await expect(
        page.getByRole("menuitem", { name: school.name })
      ).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(() => Reflect.get(window, "nakafaSchoolRow"))
      ).toStrictEqual([true]);
    });
  }
);

/**
 * A signed-in screen renders only in the browser, so its first HTML holds no page. Until the scripts
 * arrive the empty stage draws its loader, and it goes with the first element React draws.
 */
test("a signed-in screen shows a loader until its scripts arrive", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const origin = yield* Effect.fromNullishOr(baseURL);
      yield* seedAnalyticsConsent(page, "denied");
      yield* signInLearner(page.context(), origin);
      yield* Effect.promise(async () => {
        const held = MutableList.make<Route>();
        await page.route(SCRIPTS, (route) => {
          MutableList.append(held, route);
        });
        await page.goto("/en/notifications", {
          waitUntil: "domcontentloaded",
        });
        const stage = page.locator('[data-slot="drawer-stage"]');
        const loaderContent = () =>
          stage.evaluate(
            (element) => getComputedStyle(element, "::after").content
          );
        await expect.poll(loaderContent).not.toBe("none");
        for (const route of MutableList.toArray(held)) {
          await route.continue();
        }
        await page.unroute(SCRIPTS);
        await expect
          .poll(loaderContent, { timeout: readinessTimeoutMilliseconds })
          .toBe("none");
      });
    })
  );
});

test.describe("the account menu's schools", () => {
  test("stand in the menu's first frame on a phone", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({
      height: touchViewport.height,
      width: touchViewport.width,
    });
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) =>
            verifySchoolsFirstFrame(page, origin, true)
          )
        )
      )
    );
  });

  test("stand in the menu's first frame on a desktop", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({
      height: desktopViewport.height,
      width: desktopViewport.width,
    });
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) =>
            verifySchoolsFirstFrame(page, origin, false)
          )
        )
      )
    );
  });
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
