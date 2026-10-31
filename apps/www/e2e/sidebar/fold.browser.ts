import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect, HashSet, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The search row's placeholder, which the check follows. */
const PLACEHOLDER = app.Utils["search-bar-placeholder"];
/** Longer than the sidebar's fold, so a toggle has finished moving. */
const FOLD_MILLISECONDS = 600;

/** The height of the placeholder on each frame the page drew it. */
const Heights = Schema.Array(Schema.Finite);

/**
 * Records, on every frame, the height of the search row's placeholder, so a
 * placeholder that wraps onto a second line while its row narrows shows.
 */
function watchPlaceholder(label: string) {
  const heights: number[] = [];
  Object.assign(window, { nakafaPlaceholder: heights });
  const look = () => {
    const placeholder = Array.from(
      document.querySelectorAll('[data-sidebar="menu-button"] span')
    ).find((span) => span.textContent === label);
    if (placeholder !== undefined) {
      heights.push(Math.round(placeholder.getBoundingClientRect().height));
    }
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

/** Every height the placeholder took since the page started watching. */
const readHeights = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(() => Reflect.get(window, "nakafaPlaceholder"))
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Heights)));

/**
 * The search row's placeholder keeps one line while the sidebar folds and
 * opens: it clips as its row narrows, like every other row's label, and never
 * wraps onto a second line for a frame.
 */
const verifyFold = Effect.fn("NakafaE2E.verifySearchRowFold")(function* (
  page: Page,
  first: Effect.Effect<void>,
  second: Effect.Effect<void>
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() =>
    page.addInitScript(watchPlaceholder, PLACEHOLDER)
  );
  yield* Effect.promise(() => page.goto("/en/try-out"));
  yield* first;
  yield* Effect.promise(() => page.waitForTimeout(FOLD_MILLISECONDS));
  yield* second;
  yield* Effect.promise(() => page.waitForTimeout(FOLD_MILLISECONDS));
  const heights = yield* readHeights(page);
  yield* Effect.sync(() => {
    expect(heights.length).toBeGreaterThan(0);
    expect(HashSet.size(HashSet.fromIterable(heights))).toBe(1);
  });
});

/** Presses the toggle at the foot of the desktop sidebar. */
const pressRailToggle = (page: Page) =>
  Effect.promise(async () => {
    const toggle = page
      .locator('[data-slot="sidebar-container"]')
      .getByRole("button", { name: "Toggle Sidebar" });
    await waitUntilTakenOver(toggle);
    await toggle.click();
  });

test("at 1440px the search row's placeholder keeps one line while the sidebar folds and opens", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      verifyFold(page, pressRailToggle(page), pressRailToggle(page))
    )
  );
});

test("at 390px the search row's placeholder keeps one line while the sidebar sheet opens and closes", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      verifyFold(
        page,
        Effect.promise(async () => {
          const toggle = page
            .locator('[data-slot="page-header"]')
            .getByRole("button", { name: "Toggle Sidebar" });
          await waitUntilTakenOver(toggle);
          await toggle.click();
        }),
        Effect.promise(() => page.keyboard.press("Escape"))
      )
    )
  );
});
