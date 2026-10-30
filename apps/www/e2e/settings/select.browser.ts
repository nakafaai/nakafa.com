import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { signInLearner } from "@/e2e/support/learner";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The learning settings, whose curriculum select holds the longest values of the app. */
const LEARNING_PATH = `${appRoutes.settings}/learning`;

/** The pages whose selects show a value from the start. */
const SELECT_PAGES = [pinnedRoutes.upcoming.en, appRoutes.tryout] as const;

/**
 * Where a select's value and chevron stand in its trigger: the value is drawn in
 * full or clamped inside its own box, and ends before the chevron, which ends
 * inside the trigger. Read in one frame, in the page.
 */
const readFit = (trigger: Locator) =>
  trigger.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const value = element.querySelector('[data-slot="select-value"]');
    const chevron = element.lastElementChild;
    if (!(value instanceof HTMLElement && chevron instanceof Element)) {
      return {
        chevronInside: false,
        valueClamped: false,
        valueEndsFirst: false,
      };
    }
    const valueBox = value.getBoundingClientRect();
    const chevronBox = chevron.getBoundingClientRect();
    return {
      chevronInside: chevronBox.right <= box.right + 0.5,
      valueClamped: value.scrollWidth <= value.clientWidth + 0.5,
      valueEndsFirst: valueBox.right <= chevronBox.left + 0.5,
    };
  });

const expectFits = Effect.fn("NakafaE2E.expectSelectFits")(function* (
  trigger: Locator
) {
  yield* Effect.promise(() =>
    expect
      .poll(() => readFit(trigger))
      .toEqual({
        chevronInside: true,
        valueClamped: true,
        valueEndsFirst: true,
      })
  );
});

/** Chooses the option with the longest name in the select that `trigger` opens. */
const chooseLongest = Effect.fn("NakafaE2E.chooseLongestOption")(function* (
  page: Page,
  trigger: Locator
) {
  yield* Effect.promise(() => waitUntilTakenOver(trigger));
  yield* Effect.promise(() => trigger.click());
  const options = page.getByRole("option");
  yield* Effect.promise(() =>
    expect(options.first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  const names = yield* Effect.promise(() => options.allInnerTexts());
  const longest = Arr.reduce(names, "", (kept, name) =>
    name.length > kept.length ? name : kept
  );
  yield* Effect.promise(() =>
    options.filter({ hasText: longest }).first().click()
  );
});

for (const width of [390, 1440]) {
  test.describe(`selects at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("the longest curriculum and role stay inside their selects", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          yield* signInLearner(page.context(), origin);
          yield* Effect.promise(() => page.goto(LEARNING_PATH));
          for (const id of [
            "#user-settings-curriculum",
            "#user-settings-role",
          ]) {
            const trigger = page.locator(id);
            yield* chooseLongest(page, trigger);
            yield* expectFits(trigger);
          }
        })
      );
    });

    for (const path of SELECT_PAGES) {
      test(`the selects of ${path} hold their values inside`, async ({
        baseURL,
        page,
      }) => {
        await runOnPage(page, baseURL, () =>
          Effect.gen(function* () {
            yield* seedAnalyticsConsent(page, "denied");
            yield* Effect.promise(() => page.goto(path));
            const triggers = page
              .locator('[data-slot="select-trigger"]')
              .filter({ visible: true });
            yield* Effect.promise(() =>
              expect(triggers.first()).toBeVisible({
                timeout: readinessTimeoutMilliseconds,
              })
            );
            const count = yield* Effect.promise(() => triggers.count());
            for (const index of Arr.range(0, count - 1)) {
              yield* expectFits(triggers.nth(index));
            }
          })
        );
      });
    }
  });
}
