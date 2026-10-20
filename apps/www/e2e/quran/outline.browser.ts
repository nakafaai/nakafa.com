import { expect, type Page, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { seedAnalyticsConsent } from "../support/consent";
import { pinnedRoutes } from "../support/corpus";
import {
  expectUncovered,
  readLayoutShift,
  waitForSlide,
} from "../support/layout";
import { waitForCommittedAppRouter } from "../support/navigation/readiness";
import { withObservedPageErrors } from "../support/observe";
import { APP_SCRIPT_PATTERN } from "../support/requests";
import { appRoutes } from "../support/route";
import { readinessTimeoutMilliseconds } from "../support/timeout";

// Long enough that the server-rendered page paints before it hydrates.
const heldScriptMilliseconds = 1000;

const verifyOutlineHydration = Effect.fn("NakafaE2E.verifyOutlineHydration")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    // Holding the app's scripts back paints the server-rendered outline first,
    // as a slow device does; its rows must not move when the page hydrates.
    const services = yield* Effect.context<never>();
    yield* Effect.promise(() =>
      page.route(APP_SCRIPT_PATTERN, (route) =>
        Effect.runPromiseWith(services)(
          Effect.sleep(Duration.millis(heldScriptMilliseconds)).pipe(
            Effect.andThen(() => Effect.promise(() => route.continue()))
          )
        )
      )
    );

    // Al-Baqarah has the longest outline and Al-Fatihah the shortest.
    for (const href of [appRoutes.quranSurah, "/en/quran/1"]) {
      yield* Effect.promise(() =>
        page.goto(href, { waitUntil: "domcontentloaded" })
      );
      yield* waitForCommittedAppRouter(
        page,
        href,
        href,
        readinessTimeoutMilliseconds
      );
      yield* Effect.promise(() => page.waitForLoadState("networkidle"));
      const layoutShift = yield* readLayoutShift(page);
      yield* Effect.sync(() => expect(layoutShift).toBeLessThan(0.01));
    }
  }
);

/**
 * The outline entry of the verse the reader is on is active, however far down
 * the surah that verse is, and it leaves that state once its verse does.
 */
const verifyVerseActive = Effect.fn("NakafaE2E.verifyVerseActive")(function* (
  page: Page
) {
  const href = appRoutes.quranSurah;
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(href));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
  const outline = page.locator(
    '[data-side="right"] [data-slot="sidebar-content"]'
  );
  const entry = outline.getByRole("link", { exact: true, name: "Verse 200" });
  yield* Effect.promise(() => entry.click());
  yield* Effect.promise(() =>
    expect(entry).toHaveAttribute("data-active", "true", {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  // Back at the top, the verse leaves the reading band and its entry must not
  // stay active.
  yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
  yield* Effect.promise(() =>
    expect(entry).toHaveAttribute("data-active", "false", {
      timeout: readinessTimeoutMilliseconds,
    })
  );
});

test.describe("Desktop outline", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("marks the outline entry of the verse being read", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyVerseActive(page))
    );
  });

  test("keeps its entries still while the page hydrates", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyOutlineHydration(page))
    );
  });
});

/**
 * Below the desktop width the outline is a sheet over the lesson. Choosing a
 * heading jumps to it with native fragment navigation and closes the sheet,
 * so the reader lands on the heading instead of the sheet that covers it.
 */
const verifyPhoneOutlineJump = Effect.fn("NakafaE2E.verifyPhoneOutlineJump")(
  function* (page: Page) {
    const href = pinnedRoutes.material.en;
    yield* seedAnalyticsConsent(page, "denied");
    yield* Effect.promise(() => page.goto(href));
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
    yield* Effect.promise(() =>
      page.getByRole("button", { name: "On this page" }).click()
    );
    const sheet = page.getByRole("dialog");
    const heading = sheet.locator('a[href^="#"]').nth(2);
    yield* Effect.promise(() => expect(heading).toBeVisible());
    const fragment = yield* Effect.promise(() => heading.getAttribute("href"));
    const label = yield* Effect.promise(() => heading.getAttribute("title"));
    yield* Effect.promise(() => heading.click());
    yield* Effect.promise(() => expect(sheet).toBeHidden());
    yield* Effect.promise(() => expect(page).toHaveURL(`${href}${fragment}`));
    yield* expectUncovered(
      page.getByRole("heading", { exact: true, name: `Link to ${label}` }),
      readinessTimeoutMilliseconds
    );
  }
);

/**
 * Choosing verse 200 in the sheet of a phone closes the sheet and lands the
 * verse right under the headers, which the landing checks measure in full.
 */
const verifyPhoneVerseJump = Effect.fn("NakafaE2E.verifyPhoneVerseJump")(
  function* (page: Page) {
    const href = appRoutes.quranSurah;
    yield* seedAnalyticsConsent(page, "denied");
    yield* Effect.promise(() => page.goto(href));
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
    yield* Effect.promise(() =>
      page.getByRole("button", { name: "On this page" }).click()
    );
    const sheet = page.getByRole("dialog");
    // On slow runners the outline can still move after a jump made while the
    // sheet slides in, so the jump waits for the slide to finish.
    yield* waitForSlide(sheet);
    yield* Effect.promise(() =>
      sheet.getByRole("link", { exact: true, name: "Verse 200" }).click()
    );
    yield* Effect.promise(() => expect(sheet).toBeHidden());
    yield* expectUncovered(
      page.locator("#verse-200"),
      readinessTimeoutMilliseconds
    );
  }
);

test.describe("Phone outline", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("closes after a heading is chosen", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPhoneOutlineJump(page))
    );
  });

  test("closes after a far verse is chosen", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPhoneVerseJump(page))
    );
  });
});
