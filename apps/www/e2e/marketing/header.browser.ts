import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const HOME = "/en";

/**
 * Samples the scroll position on every animation frame until the page has stayed
 * still for half a second after it moved, and counts the positions it passed
 * between its start and its end. A smooth scroll passes through positions, an
 * instant jump does not. It runs in the page, so it uses no import.
 */
function countPassedPositions() {
  return new Promise<number>((resolve) => {
    const startedAt = performance.now();
    const start = window.scrollY;
    const positions: number[] = [];
    let lastTop = start;
    let stillFrames = 0;

    const sample = () => {
      if (window.scrollY === lastTop) {
        stillFrames += 1;
      } else {
        lastTop = window.scrollY;
        positions.push(lastTop);
        stillFrames = 0;
      }
      const settled = lastTop !== start && stillFrames >= 30;
      if (!settled && performance.now() - startedAt < 10_000) {
        requestAnimationFrame(sample);
        return;
      }
      const end = lastTop;
      resolve(positions.filter((top) => top !== end).length);
    };
    requestAnimationFrame(sample);
  });
}

/**
 * How far the section with the given id sits from the place its scroll margin
 * leaves for it. Zero when it is there. It runs in the page, so the id is passed
 * in as an argument.
 */
function readSectionGap(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) {
    return Number.NaN;
  }
  return (
    section.getBoundingClientRect().top -
    Number.parseFloat(getComputedStyle(section).scrollMarginTop)
  );
}

/**
 * Chooses Features in the header of the home page, where the lesson section is
 * on the same page. The jump must pass through positions on its way, as a smooth
 * scroll does, and the section must land under the header.
 */
const verifySectionGlide = Effect.fn("NakafaE2E.verifySectionGlide")(function* (
  page: Page
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(HOME));
  yield* waitForCommittedAppRouter(
    page,
    HOME,
    HOME,
    readinessTimeoutMilliseconds
  );
  // The header draws this link with a button role, so it is found by its label.
  const features = page
    .locator("header")
    .getByText("Features", { exact: true });
  yield* Effect.promise(() =>
    expect(features).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  const sampling = page.evaluate(countPassedPositions);
  yield* Effect.promise(() => features.click());
  const passed = yield* Effect.promise(() => sampling);
  const gap = yield* Effect.promise(() =>
    page.evaluate(readSectionGap, LESSON_SECTION_ID)
  );
  yield* Effect.sync(() => {
    expect(passed).toBeGreaterThan(0);
    expect(Math.abs(gap)).toBeLessThanOrEqual(1);
  });
});

test.describe("Marketing header", () => {
  test.use({
    reducedMotion: "no-preference",
    viewport: { height: 900, width: 1440 },
  });

  test("glides to the lesson section from the home page", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifySectionGlide(page))
    );
  });
});
