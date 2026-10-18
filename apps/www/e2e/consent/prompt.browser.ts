import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, MutableList } from "effect";
import {
  compactContext,
  expectPromptRendered,
  observeHydrationErrors,
  PROMPT_DESCRIPTION,
  seedAnalyticsConsent,
  seedRawStorage,
  stopAppCode,
} from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readFooterActions, setLargeText } from "@/e2e/support/footer";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { NEXT_CHUNK_PATH } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { compactViewport } from "@/e2e/support/viewport";

/** An earlier notice that a browser may still hold a choice for. */
const OLDER_NOTICE_VERSION = "privacy-2026-08-21";

test("the usage data prompt is in the server HTML, paints before app code, and stays after hydration", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.promise(async () => {
          const page = await context.newPage();
          const hydrationErrors = observeHydrationErrors(page);
          await stopAppCode(page);
          const response = await page.goto(pinnedRoutes.material.en, {
            waitUntil: "domcontentloaded",
          });

          expect(await response?.text()).toContain(PROMPT_DESCRIPTION);
          await expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible();

          await page.unroute(NEXT_CHUNK_PATH);
          await page.reload({ waitUntil: "load" });

          await expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible();
          expect(MutableList.toArray(hydrationErrors)).toEqual([]);
        })
    )
  );
});

test("a visitor who already decided gets no prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          const hydrationErrors = observeHydrationErrors(page);
          yield* seedAnalyticsConsent(page, "granted");
          yield* Effect.promise(() => stopAppCode(page));
          const response = yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          expect(yield* Effect.promise(async () => response?.text())).toContain(
            PROMPT_DESCRIPTION
          );
          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
          expect(MutableList.toArray(hydrationErrors)).toEqual([]);
        })
    )
  );
});

test("a visitor who denied under an older notice gets no prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          // A denial stays a decision under any notice, as the store reads it.
          const older = yield* encodeAnonymousAnalyticsConsent({
            ...createAnonymousAnalyticsConsent("denied", 1),
            noticeVersion: OLDER_NOTICE_VERSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, older)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("a decision made under an older notice keeps the prompt before the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          // The store writes this record with the same encoder, under an older notice.
          const older = yield* encodeAnonymousAnalyticsConsent({
            ...createAnonymousAnalyticsConsent("granted", 1),
            noticeVersion: OLDER_NOTICE_VERSION,
          });
          yield* Effect.promise(() =>
            seedRawStorage(page, ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY, older)
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeVisible()
          );
        })
    )
  );
});

test("a browser privacy signal hides the prompt before and after the page hydrates", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      { baseURL: baseURL ?? "", ...compactContext },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() =>
            page.addInitScript(() => {
              Object.defineProperty(navigator, "globalPrivacyControl", {
                configurable: true,
                get: () => true,
              });
            })
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

test("a visitor with JavaScript off gets no prompt, because nothing runs to record a choice", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        ...compactContext,
        javaScriptEnabled: false,
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() => expectPromptRendered(page));
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});

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

/** The footer's content edges, and the box of each of its buttons, in CSS pixels. */
const readFooterRow = (prompt: Locator) =>
  prompt.locator('[data-slot="card-footer"]').evaluate((footer) => {
    const style = getComputedStyle(footer);
    const box = footer.getBoundingClientRect();
    return {
      actions: Array.from(footer.querySelectorAll("button"), (button) => {
        const rect = button.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      }),
      contentLeft: box.left + Number.parseFloat(style.paddingLeft),
      contentRight: box.right - Number.parseFloat(style.paddingRight),
    };
  });

const verifyActionsShareRow = Effect.fn(
  "NakafaE2E.verifyUsageDataActionsShareRow"
)(function* (page: Page) {
  const prompt = yield* openFirstVisit(page);
  const actions = yield* Effect.promise(() =>
    readFooterActions(actionsOf(prompt))
  );
  const row = yield* Effect.promise(() => readFooterRow(prompt));
  const [decline, allow] = row.actions;

  yield* Effect.sync(() => {
    expect(Arr.map(actions, ({ label }) => label)).toEqual([
      en.AnalyticsConsent.decline,
      en.AnalyticsConsent.allow,
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
    // The footer is narrower than 16rem here, and both actions still share its
    // row from one edge to the other, instead of stacking at one action's width.
    expect(row.actions).toHaveLength(2);
    expect(decline?.top).toBeLessThan(allow?.bottom ?? 0);
    expect(allow?.top).toBeLessThan(decline?.bottom ?? 0);
    expect(decline?.right).toBeLessThanOrEqual(allow?.left ?? 0);
    expect(decline?.left).toBeCloseTo(row.contentLeft, 0);
    expect(allow?.right).toBeCloseTo(row.contentRight, 0);
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

/** A 300 px phone, whose usage data footer is narrower than 16rem at the default text size. */
const narrowPhone = { height: 800, width: 300 };

test.describe("the usage data prompt on a narrow phone", () => {
  test.use({
    viewport: { height: narrowPhone.height, width: narrowPhone.width },
  });

  test("shares the footer's row between both actions", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyActionsShareRow(page))
    );
  });
});
