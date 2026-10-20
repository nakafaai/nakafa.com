import { expect, type Page, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForSlide } from "@/e2e/support/layout";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How far the verse's number row sits below the headers stuck to the top of the screen. Zero is right under them. */
function readVerseGap(id: string) {
  const anchor = document.getElementById(id);
  if (!anchor) {
    return Number.NaN;
  }
  const stackBottom = Math.max(
    0,
    ...Array.from(document.querySelectorAll("header"), (header) => {
      const style = getComputedStyle(header);
      const box = header.getBoundingClientRect();
      const stuck =
        style.position === "sticky" &&
        box.height > 0 &&
        box.top <= Number.parseFloat(style.top) + 1;
      return stuck ? box.bottom : 0;
    })
  );
  return anchor.getBoundingClientRect().top - stackBottom;
}

/**
 * How many pixels the surah header's content reaches below the inside of its
 * box. Zero when every row ends inside the box. A visible overflow does not
 * change scroll height, so each element is measured against the box edge.
 */
function readHeaderOverflow() {
  const header = document
    .querySelector('[data-slot="surah-header-actions"]')
    ?.closest("header");
  if (!header) {
    return Number.NaN;
  }
  const inside =
    header.getBoundingClientRect().bottom -
    Number.parseFloat(getComputedStyle(header).borderBottomWidth);
  let overflow = 0;
  for (const element of Array.from(header.querySelectorAll("*"))) {
    overflow = Math.max(
      overflow,
      element.getBoundingClientRect().bottom - inside
    );
  }
  return overflow;
}

/** The outline of the surah page on the right, whether it is the panel or the sheet of a phone. */
function outlineLinks(page: Page, sheet: boolean) {
  return sheet
    ? page.getByRole("dialog").locator('[data-slot="sidebar-content"]')
    : page.locator('[data-side="right"] [data-slot="sidebar-content"]');
}

/** Opens a surah from its own address and waits until the page has hydrated. */
const openSurah = Effect.fn("NakafaE2E.openSurah")(function* (
  page: Page,
  href: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(href));
  yield* waitForCommittedAppRouter(
    page,
    appRoutes.quranSurah,
    appRoutes.quranSurah,
    readinessTimeoutMilliseconds
  );
});

/**
 * Waits until the verse's number row sits right under the headers, within a
 * pixel, and checks that it still does a second later: a jump that moves
 * afterwards was not a landing.
 */
const expectLanded = Effect.fn("NakafaE2E.expectLanded")(function* (
  page: Page,
  id: string
) {
  yield* Effect.promise(() =>
    expect
      .poll(async () => Math.abs(await page.evaluate(readVerseGap, id)), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBeLessThanOrEqual(1)
  );
  yield* Effect.sleep(Duration.seconds(1));
  const gap = yield* Effect.promise(() => page.evaluate(readVerseGap, id));
  yield* Effect.sync(() => expect(Math.abs(gap)).toBeLessThanOrEqual(1));
});

/**
 * Checks that the surah header's rows end inside its height. The verse anchors
 * scroll past that height, so a row that reached below it would spill over the
 * verses under the header while the landing check still passed.
 */
const expectHeaderFits = Effect.fn("NakafaE2E.expectHeaderFits")(function* (
  page: Page
) {
  const overflow = yield* Effect.promise(() =>
    page.evaluate(readHeaderOverflow)
  );
  yield* Effect.sync(() => expect(overflow).toBeLessThanOrEqual(1));
});

/**
 * Chooses a verse in the outline. Below the desktop width the outline is a
 * sheet that opens first and closes when a verse is chosen.
 */
const chooseVerse = Effect.fn("NakafaE2E.chooseVerse")(function* (
  page: Page,
  label: string,
  sheet: boolean
) {
  if (sheet) {
    yield* Effect.promise(() =>
      page.getByRole("button", { name: "On this page" }).click()
    );
    yield* waitForSlide(page.getByRole("dialog"));
  }
  yield* Effect.promise(() =>
    outlineLinks(page, sheet)
      .getByRole("link", { exact: true, name: label })
      .click()
  );
  if (sheet) {
    yield* Effect.promise(() => expect(page.getByRole("dialog")).toBeHidden());
  }
});

/** Chooses verses 5, 81 and 250 from the outline, one after another. */
const verifyOutlineLandings = Effect.fn("NakafaE2E.verifyOutlineLandings")(
  function* (page: Page, sheet: boolean) {
    yield* openSurah(page, appRoutes.quranSurah);
    yield* expectHeaderFits(page);
    for (const number of [5, 81, 250]) {
      yield* chooseVerse(page, `Verse ${number}`, sheet);
      yield* expectLanded(page, `verse-${number}`);
    }
  }
);

/** Loads a surah at the address of verse 200, which the browser must land on itself. */
const verifyDirectLanding = Effect.fn("NakafaE2E.verifyDirectLanding")(
  function* (page: Page) {
    yield* openSurah(page, `${appRoutes.quranSurah}#verse-200`);
    yield* expectHeaderFits(page);
    yield* expectLanded(page, "verse-200");
  }
);

test.describe("Phone verse landing", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("lands each chosen outline verse right under the headers", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyOutlineLandings(page, true))
    );
  });

  test("lands a link to verse 200 right under the headers", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyDirectLanding(page))
    );
  });
});

test.describe("Desktop verse landing", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("lands each chosen outline verse right under the headers", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyOutlineLandings(page, false))
    );
  });

  test("lands a link to verse 200 right under the headers", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyDirectLanding(page))
    );
  });
});
