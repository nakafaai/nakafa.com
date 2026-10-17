import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { readFooterActions, setLargeText } from "@/e2e/support/footer";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { compactViewport } from "@/e2e/support/viewport";

/** The usage data prompt of a first visit, a region named by its title. */
const promptOf = (page: Page) =>
  page.getByRole("region", { exact: true, name: en.AnalyticsConsent.title });

/** The actions of the prompt's footer, Decline and then Allow. */
const actionsOf = (prompt: Locator) =>
  prompt.locator('[data-slot="card-footer"] button');

/** Waits for the prompt of a first visit, and for the page's fonts to load. */
const openFirstVisit = Effect.fn("NakafaE2E.openUsageDataPrompt")(function* (
  page: Page
) {
  yield* Effect.promise(() => page.goto("/en"));
  const prompt = promptOf(page);
  yield* Effect.promise(() =>
    expect(prompt).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() =>
    page.evaluate(async () => {
      await document.fonts.ready;
    })
  );
  return prompt;
});

const verifyActionsAtLargeText = Effect.fn(
  "NakafaE2E.verifyUsageDataActionsAtLargeText"
)(function* (page: Page) {
  const prompt = yield* openFirstVisit(page);

  const rootSize = yield* setLargeText(page);
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(prompt))
  );

  yield* Effect.sync(() => {
    expect(rootSize).toBe("32px");
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      en.AnalyticsConsent.decline,
      en.AnalyticsConsent.allow,
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
  });
  yield* Effect.promise(async () => {
    await expect(
      prompt.getByRole("button", {
        exact: true,
        name: en.AnalyticsConsent.decline,
      })
    ).toBeVisible();
    await expect(
      prompt.getByRole("button", {
        exact: true,
        name: en.AnalyticsConsent.allow,
      })
    ).toBeVisible();
  });
});

const verifyActionsOnOneRow = Effect.fn(
  "NakafaE2E.verifyUsageDataActionsOnOneRow"
)(function* (page: Page) {
  const prompt = yield* openFirstVisit(page);
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(prompt))
  );

  yield* Effect.sync(() => {
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      en.AnalyticsConsent.decline,
      en.AnalyticsConsent.allow,
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
    // At the default text size both actions sit on one row.
    expect(Arr.dedupe(Arr.map(actions, ({ top }) => top))).toHaveLength(1);
  });
});

test.describe("the usage data prompt on the smallest phone", () => {
  test.use({
    viewport: { height: compactViewport.height, width: compactViewport.width },
  });

  test("keeps both actions inside its card and visible at 200% text", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyActionsAtLargeText(page))
    );
  });

  test("shows both actions on one row at the default text size", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyActionsOnOneRow(page))
    );
  });
});
