import {
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
  createAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { NEXT_CHUNK_PATH } from "@/e2e/support/route";

/** The first words of the usage-data prompt's description in English. */
const PROMPT_DESCRIPTION = "Allow Nakafa to see which features you use";

/** An earlier notice that a browser may still hold a choice for. */
const OLDER_NOTICE_VERSION = "privacy-2026-08-21";

/** A phone, where the prompt covers the lower part of the lesson. */
const compactContext: BrowserContextOptions = {
  hasTouch: true,
  serviceWorkers: "block",
  viewport: { height: 844, width: 390 },
};

/** React reports a hydration mismatch as a console error that names it. */
const HYDRATION_ERROR = /hydrat|#41[89]|#42[35]/iu;

/**
 * Stops every app chunk from loading, so the page stays as the server sent it
 * and only the inline bootstrap script and the stylesheet can act.
 */
async function stopAppCode(page: Page) {
  await page.route(NEXT_CHUNK_PATH, (route) => route.abort());
}

/** Collects the hydration errors that the page reports while it runs. */
function observeHydrationErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_ERROR.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

/** Stores a raw record under the key the consent store reads, before the page loads. */
function seedRawStorage(page: Page, key: string, value: string) {
  return page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key, value }
  );
}

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
          expect(hydrationErrors).toEqual([]);
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
          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );

          yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
          yield* Effect.promise(() => page.reload({ waitUntil: "load" }));

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
          expect(hydrationErrors).toEqual([]);
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

test("a signed-in choice this browser keeps hides the prompt before the page hydrates", async ({
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
            seedRawStorage(
              page,
              ANALYTICS_CONSENT_ACCOUNT_STORAGE_KEY,
              ANALYTICS_CONSENT_NOTICE_VERSION
            )
          );
          yield* Effect.promise(() => stopAppCode(page));
          yield* Effect.promise(() =>
            page.goto(pinnedRoutes.material.en, {
              waitUntil: "domcontentloaded",
            })
          );

          yield* Effect.promise(() =>
            expect(page.getByText(PROMPT_DESCRIPTION)).toBeHidden()
          );
        })
    )
  );
});
