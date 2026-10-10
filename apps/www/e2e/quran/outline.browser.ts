import { expect, type Locator, type Page, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import {
  expectUncovered,
  readLayoutShift,
  waitForSlide,
} from "@/e2e/support/layout";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { APP_SCRIPT_PATTERN } from "@/e2e/support/requests";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

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

    // Al-Baqarah virtualizes its long outline; Al-Fatihah renders all of it.
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
 * Scrolls a virtualized outline until it renders the entry for verse 200, and
 * waits for ten still frames: a tap that lands while the list still moves
 * reaches no entry. The scroll waits until the virtualizer positions the
 * entries, which it does once it follows the outline's scrolling.
 */
const revealVerseEntry = Effect.fn("NakafaE2E.revealVerseEntry")(function* (
  outline: Locator
) {
  yield* Effect.promise(() =>
    expect(
      outline.locator('[data-slot="sidebar-menu-item"]').first()
    ).toHaveCSS("position", "absolute", {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() =>
    outline.evaluate(
      (node) =>
        new Promise<void>((resolve) => {
          const entry = node.querySelector('[data-slot="sidebar-menu-item"]');
          node.scrollTop = (entry?.getBoundingClientRect().height ?? 0) * 199;
          let lastTop = node.scrollTop;
          let stillFrames = 0;
          const check = () => {
            stillFrames = node.scrollTop === lastTop ? stillFrames + 1 : 0;
            lastTop = node.scrollTop;
            if (stillFrames === 10) {
              resolve();
              return;
            }
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        })
    )
  );
});

/**
 * Verses past the document flow mount only while the virtualizer renders
 * them, and their outline entries still follow the reading position.
 */
const verifyVirtualVerseActive = Effect.fn(
  "NakafaE2E.verifyVirtualVerseActive"
)(function* (page: Page) {
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
  yield* revealVerseEntry(outline);
  const entry = outline.getByRole("button", { exact: true, name: "Verse 200" });
  yield* Effect.promise(() => entry.click());
  yield* Effect.promise(() =>
    expect(entry).toHaveAttribute("data-active", "true", {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  // Back at the top, the verse unmounts before it leaves the reading band,
  // and its entry must not stay active.
  yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
  yield* Effect.promise(() =>
    expect(entry).toHaveAttribute("data-active", "false", {
      timeout: readinessTimeoutMilliseconds,
    })
  );
});

test.describe("Desktop outline", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("follows the reading verse past the leading verses", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyVirtualVerseActive(page))
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
 * Al-Baqarah virtualizes the verses past the document flow, and its long
 * outline too: scrolling the outline renders the entry for verse 200, and
 * choosing it closes the sheet and scrolls the verse in below the headers.
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
    yield* revealVerseEntry(sheet.locator('[data-slot="sidebar-content"]'));
    yield* Effect.promise(() =>
      sheet.getByRole("button", { exact: true, name: "Verse 200" }).click()
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
